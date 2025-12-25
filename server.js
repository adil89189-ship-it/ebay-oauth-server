import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

let cachedOfferMap = {}; // amazonSku -> offerId

/* =========================
   GET EBAY ACCESS TOKEN
========================= */
async function getAccessToken() {
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization":
        "Basic " +
        Buffer.from(
          `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.EBAY_REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await res.json();
  return data.access_token;
}

/* =========================
   BUILD SKU → OFFER MAP
========================= */
async function buildOfferMap() {
  const token = await getAccessToken();

  const res = await fetch(
    "https://api.ebay.com/sell/inventory/v1/offer?limit=200",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  const data = await res.json();

  cachedOfferMap = {};
  (data.offers || []).forEach((o) => {
    if (o.sku && o.offerId) {
      cachedOfferMap[o.sku] = o.offerId;
    }
  });

  console.log("🟢 Offer map built:", cachedOfferMap);
}

/* =========================
   SYNC PRICE & QTY
========================= */
app.post("/sync/sku", async (req, res) => {
  const { amazonSku, price, quantity } = req.body;

  if (!cachedOfferMap[amazonSku]) {
    await buildOfferMap();
  }

  const offerId = cachedOfferMap[amazonSku];
  if (!offerId) {
    return res.status(404).json({ error: "Offer not found" });
  }

  const token = await getAccessToken();

  await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pricingSummary: { price: { value: price, currency: "GBP" } },
        availableQuantity: quantity
      })
    }
  );

  res.json({ success: true });
});

app.listen(3000, () =>
  console.log("🟢 eBay OAuth server running on port 3000")
);
