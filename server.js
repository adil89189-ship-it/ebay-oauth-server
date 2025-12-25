import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_OFFER_URL = "https://api.ebay.com/sell/inventory/v1/offer";

let refreshToken = process.env.EBAY_REFRESH_TOKEN || null;

/* =========================
   TOKEN HELPER
========================= */
async function getAccessToken() {
  if (!refreshToken) {
    throw new Error("No refresh token stored");
  }

  const auth = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await res.json();
  return data.access_token;
}

/* =========================
   OAUTH EXCHANGE
========================= */
app.post("/exchange-token", async (req, res) => {
  try {
    const { code } = req.body;

    const auth = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RUNAME
      })
    });

    const data = await tokenRes.json();
    refreshToken = data.refresh_token;

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   MAP AMAZON SKU → OFFER ID
========================= */
app.get("/map-offers", async (req, res) => {
  try {
    const token = await getAccessToken();

    const r = await fetch(EBAY_OFFER_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    const data = await r.json();
    const mapping = {};

    (data.offers || []).forEach((o) => {
      if (o.sku && o.offerId) {
        mapping[o.sku] = o.offerId;
      }
    });

    res.json(mapping);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   SYNC PRICE & QUANTITY
========================= */
app.post("/sync/sku", async (req, res) => {
  try {
    const { offerId, price, quantity } = req.body;
    const token = await getAccessToken();

    await fetch(`${EBAY_OFFER_URL}/${offerId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pricingSummary: {
          price: { value: price, currency: "GBP" }
        },
        availableQuantity: quantity
      })
    });

    await fetch(`${EBAY_OFFER_URL}/${offerId}/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🟢 eBay sync server running on port", PORT);
});
