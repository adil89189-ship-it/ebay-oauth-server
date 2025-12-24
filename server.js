import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

let auth = {
  access_token: null,
  refresh_token: null,
  expires_at: 0
};

/* =========================
   TOKEN HELPERS
========================= */
async function refreshTokenIfNeeded() {
  if (Date.now() < auth.expires_at - 60000) return;

  const res = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: auth.refresh_token,
      scope: "https://api.ebay.com/oauth/api_scope sell.inventory"
    }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      }
    }
  );

  auth.access_token = res.data.access_token;
  auth.expires_at = Date.now() + res.data.expires_in * 1000;
}

/* =========================
   OAUTH EXCHANGE
========================= */
app.post("/oauth/exchange", async (req, res) => {
  try {
    const { code } = req.body;

    const tokenRes = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RU_NAME
      }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    auth = {
      access_token: tokenRes.data.access_token,
      refresh_token: tokenRes.data.refresh_token,
      expires_at: Date.now() + tokenRes.data.expires_in * 1000
    };

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

/* =========================
   MAIN SYNC ENDPOINT
========================= */
app.post("/sync/inventory", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, multiplier, inStock } = req.body;

    await refreshTokenIfNeeded();

    const price = (amazonPrice * multiplier).toFixed(2);
    const quantity = inStock ? 10 : 0;

    // 1️⃣ Get Inventory Item
    const item = await axios.get(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        headers: { Authorization: `Bearer ${auth.access_token}` }
      }
    );

    const offerId = item.data.offerIds?.[0];
    if (!offerId) throw "No offer linked to SKU";

    // 2️⃣ Update Quantity
    await axios.put(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        availability: {
          shipToLocationAvailability: { quantity }
        }
      },
      { headers: { Authorization: `Bearer ${auth.access_token}` } }
    );

    // 3️⃣ Update Price
    await axios.put(
      `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
      {
        pricingSummary: {
          price: { value: price, currency: "GBP" }
        }
      },
      { headers: { Authorization: `Bearer ${auth.access_token}` } }
    );

    res.json({ success: true, price, quantity });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

/* =========================
   AUTO SYNC BY SKU
========================= */
app.post("/sync/by-sku", async (req, res) => {
  // Extension triggers this
  // Amazon data should be re-fetched here if needed
  res.json({ ok: true });
});

/* =========================
   START SERVER
========================= */
app.listen(process.env.PORT, () =>
  console.log("🚀 Backend running on port", process.env.PORT)
);
