import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const RUNAME = process.env.EBAY_RUNAME;

// In-memory stores (we will persist later)
global.ebayToken = null;
const skuStore = new Map();

/* ============================
   ROOT HEALTH CHECK
============================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server Running");
});

/* ============================
   AUTH START
============================ */
app.get("/auth", (req, res) => {
  const scope =
    "https://api.ebay.com/oauth/api_scope " +
    "https://api.ebay.com/oauth/api_scope/sell.inventory " +
    "https://api.ebay.com/oauth/api_scope/sell.account";

  const url =
    `https://auth.ebay.com/oauth2/authorize?client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${RUNAME}` +
    `&scope=${encodeURIComponent(scope)}`;

  res.redirect(url);
});

/* ============================
   OAUTH CALLBACK HANDLER
============================ */
async function handleCallback(req, res) {
  const code = req.query.code;
  if (!code) return res.send("❌ Missing authorization code");

  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization":
        "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    },
    body: `grant_type=authorization_code&code=${code}&redirect_uri=${RUNAME}`
  });

  const data = await tokenRes.json();
  if (!data.access_token) return res.send("❌ Token exchange failed");

  global.ebayToken = data;
  res.send("✅ eBay connected successfully. You may close this window.");
}

app.get("/callback", handleCallback);
app.get("/oauth/callback", handleCallback);

/* ============================
   AUTH STATUS
============================ */
app.get("/status", (req, res) => {
  if (!global.ebayToken)
    return res.json({ ok: false, message: "Not authenticated" });
  res.json({ ok: true });
});

/* ============================
   SKU REGISTRATION
============================ */
app.post("/register-sku", (req, res) => {
  if (!global.ebayToken)
    return res.status(401).json({ ok: false, message: "Not authenticated" });

  const { amazonSku, ebayItemId, multiplier, quantity } = req.body;
  if (!amazonSku || !ebayItemId)
    return res.status(400).json({ ok: false, message: "Missing required fields" });

  skuStore.set(amazonSku, {
    amazonSku,
    ebayItemId,
    multiplier: Number(multiplier || 1),
    quantity: Number(quantity || 1),
    lastSync: null
  });

  res.json({ ok: true, message: "SKU registered" });
});

/* ============================
   LIVE INVENTORY SYNC
============================ */
app.post("/sync-now", async (req, res) => {
  if (!global.ebayToken)
    return res.status(401).json({ ok: false, message: "Not authenticated" });

  const { amazonSku, newQuantity } = req.body;

  const sku = skuStore.get(amazonSku);
  if (!sku)
    return res.status(404).json({ ok: false, message: "SKU not registered" });

  const payload = {
    availability: {
      shipToLocationAvailability: {
        quantity: newQuantity ?? sku.quantity
      }
    }
  };

  const url = `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku.ebayItemId}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${global.ebayToken.access_token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB"
    },
    body: JSON.stringify(payload)
  });

  let result = {};
  try { result = await response.json(); } catch {}

  sku.lastSync = new Date().toISOString();
  res.json({ ok: true, ebayResponse: result });
});

/* ============================
   BIND INVENTORY → OFFER → LISTING
============================ */
app.post("/bind-listing", async (req, res) => {
  if (!global.ebayToken)
    return res.status(401).json({ ok: false, message: "Not authenticated" });

  const { sku, price, quantity } = req.body;

  const offerPayload = {
    sku,
    marketplaceId: "EBAY_GB",
    format: "FIXED_PRICE",
    availableQuantity: quantity,
    categoryId: "176972",
    listingDescription: "Auto-synced product",
    pricingSummary: {
      price: { value: price, currency: "GBP" }
    },
    listingPolicies: {
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID
    }
  };

  const createOffer = await fetch("https://api.ebay.com/sell/inventory/v1/offer", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${global.ebayToken.access_token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB"
    },
    body: JSON.stringify(offerPayload)
  });

  const offerData = await createOffer.json();

  const publishOffer = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer/${offerData.offerId}/publish`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${global.ebayToken.access_token}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      }
    }
  );

  let publishResult = {};
  try { publishResult = await publishOffer.json(); } catch {}

  res.json({ ok: true, offerId: offerData.offerId, publishResult });
});

/* ============================
   SERVER START
============================ */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
