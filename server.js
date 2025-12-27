import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const RUNAME = process.env.EBAY_RUNAME;

let ebayToken = null;

// In-memory SKU store
const skuStore = new Map();

// =====================
// HEALTH CHECK
// =====================
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server Running");
});

// =====================
// AUTH START
// =====================
app.get("/auth", (req, res) => {
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.account"
  ].join(" ");

  const url =
    `https://auth.ebay.com/oauth2/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${RUNAME}` +
    `&scope=${encodeURIComponent(scopes)}`;

  res.redirect(url);
});

// =====================
// CALLBACK
// =====================
async function handleCallback(req, res) {
  const code = req.query.code;
  if (!code) return res.send("❌ Missing authorization code");

  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    },
    body: `grant_type=authorization_code&code=${code}&redirect_uri=${RUNAME}`
  });

  const data = await tokenRes.json();

  if (!data.access_token) return res.send("❌ Token exchange failed");

  ebayToken = data;
  res.send("✅ eBay connected successfully. You may close this window.");
}

app.get("/callback", handleCallback);
app.get("/oauth/callback", handleCallback);

// =====================
// AUTH STATUS
// =====================
app.get("/status", (req, res) => {
  if (!ebayToken) return res.json({ ok: false, message: "Not authenticated" });
  res.json({ ok: true });
});

// =====================
// REGISTER SKU
// =====================
app.post("/register-sku", (req, res) => {
  if (!ebayToken) return res.status(401).json({ ok: false, message: "Not authenticated" });

  const { amazonSku, ebayItemId, multiplier = 1, quantity = 1 } = req.body;

  skuStore.set(amazonSku, {
    amazonSku,
    ebayItemId,
    multiplier,
    quantity
  });

  res.json({ ok: true, message: "SKU registered" });
});

// =====================
// CONVERT LISTING TO INVENTORY OFFER
// =====================
app.post("/bind-listing", async (req, res) => {
  const sku = "B09TTQQ1RN";
  const ebayItemId = "187530432869";

  // Step 1 — Create Inventory Item
  await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ebayToken.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      availability: {
        shipToLocationAvailability: { quantity: 5 }
      }
    })
  });

  // Step 2 — Create Offer
  const offerRes = await fetch("https://api.ebay.com/sell/inventory/v1/offer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ebayToken.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sku,
      marketplaceId: "EBAY_GB",
      format: "FIXED_PRICE",
      availableQuantity: 5,
      listingPolicies: {
        paymentPolicyId: "234552183013",
        fulfillmentPolicyId: "251103266013",
        returnPolicyId: "236141348013"
      },
      categoryId: "176972",
      pricingSummary: {
        price: { value: "18.39", currency: "GBP" }
      }
    })
  });

  const offerData = await offerRes.json();

  // Step 3 — Publish Offer
  const publishRes = await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerData.offerId}/publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ebayToken.access_token}`,
      "Content-Type": "application/json"
    }
  });

  const publishData = await publishRes.json();

  res.json({ ok: true, publishResult: publishData });
});

// =====================
// LIVE SYNC
// =====================
app.post("/sync-now", async (req, res) => {
  const { amazonSku, newQuantity } = req.body;
  const sku = skuStore.get(amazonSku);
  if (!sku) return res.status(404).json({ ok: false, message: "SKU not registered" });

  const payload = {
    availability: {
      shipToLocationAvailability: {
        quantity: newQuantity
      }
    }
  };

  const response = await fetch(`https://api.ebay.com/sell/inventory/v1/inventory_item/${amazonSku}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${ebayToken.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  res.json({ ok: true, ebayResponse: result });
});

// =====================
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
