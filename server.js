import express from "express";
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
  EBAY_RUNAME
} = process.env;

const EBAY_API_BASE = "https://api.ebay.com";

/* ===============================
   TOKEN STORAGE
================================ */
let ebayAccessToken = null;
let ebayRefreshToken = null;
let tokenExpiry = 0;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay OAuth + Inventory Server Running" });
});

/* ===============================
   START EBAY OAUTH
================================ */
app.get("/auth/ebay", (req, res) => {
  const scope = encodeURIComponent(
    "https://api.ebay.com/oauth/api_scope " +
    "https://api.ebay.com/oauth/api_scope/sell.inventory"
  );

  const authUrl =
    `https://auth.ebay.com/oauth2/authorize` +
    `?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${EBAY_RUNAME}` +
    `&scope=${scope}`;

  res.redirect(authUrl);
});

/* ===============================
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ ok: false, error: "No authorization code" });
  }

  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: EBAY_RUNAME
        })
      }
    );

    const data = await tokenRes.json();

    if (!data.access_token || !data.refresh_token) {
      return res.status(400).json({ ok: false, error: data });
    }

    ebayAccessToken = data.access_token;
    ebayRefreshToken = data.refresh_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;

    res.json({
      ok: true,
      message: "Authorization successful (refresh token stored)"
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   AUTO REFRESH TOKEN
================================ */
async function getValidEbayToken() {
  if (ebayAccessToken && Date.now() < tokenExpiry - 60000) {
    return ebayAccessToken;
  }

  if (!ebayRefreshToken) {
    throw new Error("No refresh token available");
  }

  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: ebayRefreshToken,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    }
  );

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to refresh eBay token");
  }

  ebayAccessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return ebayAccessToken;
}

/* ===============================
   EBAY HELPERS
================================ */
async function getOfferIdBySku(sku, token) {
  const res = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  const data = await res.json();

  if (!data.offers || data.offers.length === 0) {
    throw new Error("No eBay offer found for this SKU");
  }

  return data.offers[0].offerId;
}

async function updateInventoryQuantity(sku, quantity, token) {
  const res = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: { quantity }
        }
      })
    }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }
}

async function updateOfferPrice(offerId, price, token) {
  const res = await fetch(
    `${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
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

  if (!res.ok) {
    throw new Error(await res.text());
  }
}

/* ===============================
   SYNC ROUTE (REAL UPDATE)
================================ */
app.post("/sync", async (req, res) => {
  const { amazonSku, amazonPrice, quantity, multiplier = 1 } = req.body;

  if (!amazonSku || amazonPrice == null || quantity == null) {
    return res.status(400).json({
      ok: false,
      error: "Missing amazonSku, amazonPrice, or quantity"
    });
  }

  try {
    const token = await getValidEbayToken();

    const ebaySku = amazonSku;
    const finalPrice = amazonPrice * multiplier;

    const offerId = await getOfferIdBySku(ebaySku, token);

    await updateInventoryQuantity(ebaySku, quantity, token);
    await updateOfferPrice(offerId, finalPrice, token);

    res.json({
      ok: true,
      message: "eBay inventory and price updated",
      sku: ebaySku,
      price: finalPrice,
      quantity
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
