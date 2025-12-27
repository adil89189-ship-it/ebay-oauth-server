import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   CONFIG
================================ */
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
  res.send("eBay Sync Server — LIVE");
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
   LIVE SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    if (!tokenStore.access_token) {
      return res.json({ ok: false, error: "Not authenticated" });
    }

    const { amazonPrice, multiplier, quantity, itemId } = req.body;

    const finalPrice = (amazonPrice * multiplier).toFixed(2);

    const response = await fetch(
      `${EBAY_API}/sell/inventory/v1/inventory_item/${itemId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenStore.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: { quantity }
          },
          price: {
            value: finalPrice,
            currency: "GBP"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.json({ ok: false, ebay: data });
    }

    res.json({
      ok: true,
      finalPrice,
      finalQuantity: quantity,
      ebay: data
    });

  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 LIVE Sync Server running on port ${PORT}`);
});
