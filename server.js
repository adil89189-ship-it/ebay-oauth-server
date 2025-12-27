import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const EBAY_API = "https://api.ebay.com";

let tokenStore = {
  access_token: null,
  refresh_token: null,
  expires_at: 0
};

/* ===============================
   HEALTH
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server LIVE");
});

/* ===============================
   TOKEN DEBUG
================================ */
app.get("/debug/token", (req, res) => {
  res.json({
    ok: true,
    hasAccessToken: !!tokenStore.access_token,
    hasRefreshToken: !!tokenStore.refresh_token,
    expiresAt: tokenStore.expires_at
  });
});

/* ===============================
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const { access_token, refresh_token, expires_in } = req.query;

  tokenStore.access_token = access_token;
  tokenStore.refresh_token = refresh_token;
  tokenStore.expires_at = Date.now() + Number(expires_in) * 1000;

  res.send("✅ eBay connected successfully. You may close this window.");
});

/* ===============================
   CORE SYNC ENGINE
================================ */
app.post("/sync", async (req, res) => {
  try {
    if (!tokenStore.access_token) {
      return res.json({ ok: false, error: "Not authenticated" });
    }

    const { itemId, amazonPrice, multiplier, quantity } = req.body;

    const finalPrice = (amazonPrice * multiplier).toFixed(2);

    // 1️⃣ Find offerId from Item ID
    const offerRes = await fetch(
      `${EBAY_API}/sell/inventory/v1/offer?sku=${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${tokenStore.access_token}`
        }
      }
    );

    const offerData = await offerRes.json();
    if (!offerData.offers || !offerData.offers.length) {
      return res.json({ ok: false, error: "Offer not found for item" });
    }

    const offerId = offerData.offers[0].offerId;

    // 2️⃣ Update offer
    await fetch(`${EBAY_API}/sell/inventory/v1/offer/${offerId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokenStore.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pricingSummary: {
          price: { value: finalPrice, currency: "GBP" }
        },
        availableQuantity: quantity
      })
    });

    // 3️⃣ Publish
    await fetch(`${EBAY_API}/sell/inventory/v1/offer/${offerId}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenStore.access_token}`
      }
    });

    res.json({
      ok: true,
      finalPrice,
      finalQuantity: quantity,
      offerId
    });

  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on ${PORT}`);
});
