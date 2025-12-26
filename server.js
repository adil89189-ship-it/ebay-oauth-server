import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN,
  EBAY_ENV
} = process.env;

const EBAY_API =
  EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

/* ===============================
   TOKEN REFRESH
================================ */
async function getAccessToken() {
  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: EBAY_REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Token refresh failed");
  return data.access_token;
}

/* ===============================
   UPDATE INVENTORY ITEM
================================ */
async function updateInventoryItem(sku, quantity, accessToken) {
  const res = await fetch(
    `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: {
            quantity
          }
        }
      })
    }
  );

  return res.ok;
}

/* ===============================
   GET OFFER ID BY SKU
================================ */
async function getOfferId(sku, accessToken) {
  const res = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer?sku=${sku}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const data = await res.json();
  return data.offers?.[0]?.offerId || null;
}

/* ===============================
   UPDATE OFFER PRICE
================================ */
async function updateOfferPrice(offerId, price, accessToken) {
  const res = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pricingSummary: {
          price: {
            value: price.toFixed(2),
            currency: "GBP"
          }
        }
      })
    }
  );

  return res.ok;
}

/* ===============================
   SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, inStock } = req.body;

    if (!amazonSku || amazonPrice == null) {
      return res.status(400).json({ ok: false, message: "Invalid payload" });
    }

    const DEFAULT_QTY = inStock ? 5 : 0;
    const PRICE_MULTIPLIER = 1.35;

    const finalPrice = amazonPrice * PRICE_MULTIPLIER;
    const accessToken = await getAccessToken();

    const qtyUpdated = await updateInventoryItem(
      amazonSku,
      DEFAULT_QTY,
      accessToken
    );

    const offerId = await getOfferId(amazonSku, accessToken);
    let priceUpdated = false;

    if (offerId) {
      priceUpdated = await updateOfferPrice(
        offerId,
        finalPrice,
        accessToken
      );
    }

    res.json({
      ok: true,
      sku: amazonSku,
      quantity: DEFAULT_QTY,
      price: finalPrice.toFixed(2),
      qtyUpdated,
      priceUpdated
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Inventory Sync Server Running");
});
