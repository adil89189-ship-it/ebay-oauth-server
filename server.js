import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_INVENTORY_URL = "https://api.ebay.com/sell/inventory/v1/offer";

let cachedAccessToken = null;
let tokenExpiry = 0;

/* =========================
   GET ACCESS TOKEN
========================= */
async function getAccessToken() {
  const now = Date.now();

  if (cachedAccessToken && now < tokenExpiry) {
    return cachedAccessToken;
  }

  const auth = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.EBAY_REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await response.json();

  if (!data.access_token) {
    console.error(data);
    throw new Error("Failed to refresh eBay access token");
  }

  cachedAccessToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 300) * 1000;

  return cachedAccessToken;
}

/* =========================
   SYNC PRICE & QUANTITY
========================= */
app.post("/sync/sku", async (req, res) => {
  try {
    const { offerId, price, quantity } = req.body;

    if (!offerId || !price || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const token = await getAccessToken();

    const response = await fetch(`${EBAY_INVENTORY_URL}/${offerId}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pricingSummary: {
          price: {
            value: price,
            currency: "GBP"
          }
        },
        availableQuantity: quantity
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Sync error:", err.message);
    res.status(500).json({ error: "Inventory sync failed" });
  }
});

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 eBay sync server running on port ${PORT}`);
});
/* =========================
   GET OFFER ID BY SELLER SKU
========================= */
app.get("/ebay/offer-id/:sku", async (req, res) => {
  try {
    const sellerSku = req.params.sku;
    const token = await getAccessToken();

    const response = await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${sellerSku}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      return res.status(404).json({ error: "Inventory item not found" });
    }

    const item = await response.json();

    if (!item.offerIds || !item.offerIds.length) {
      return res.status(404).json({ error: "OfferId not found" });
    }

    res.json({ offerId: item.offerIds[0] });
  } catch (err) {
    console.error("❌ OfferId lookup failed:", err.message);
    res.status(500).json({ error: "OfferId lookup failed" });
  }
});
