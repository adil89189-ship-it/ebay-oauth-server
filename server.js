import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV VARIABLES
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN,
  EBAY_ENV,
  EBAY_RUNAME
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET) {
  console.error("❌ Missing eBay client credentials");
}

/* ===============================
   EBAY API BASE
================================ */
const EBAY_API =
  EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

/* ===============================
   ACCESS TOKEN CACHE
================================ */
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_API}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope:
          "https://api.ebay.com/oauth/api_scope " +
          "https://api.ebay.com/oauth/api_scope/sell.inventory " +
          "https://api.ebay.com/oauth/api_scope/sell.account"
      })
    }
  );

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Token refresh failed");
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;

  return cachedToken;
}

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running (OPTION A)");
});

/* ===============================
   OAUTH START (REQUEST CORRECT SCOPES)
================================ */
app.get("/oauth/start", (req, res) => {
  const scope = encodeURIComponent(
    "https://api.ebay.com/oauth/api_scope " +
    "https://api.ebay.com/oauth/api_scope/sell.inventory " +
    "https://api.ebay.com/oauth/api_scope/sell.account"
  );

  const authUrl =
    "https://auth.ebay.com/oauth2/authorize" +
    `?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${EBAY_RUNAME}` +
    `&scope=${scope}`;

  res.redirect(authUrl);
});

/* ===============================
   OAUTH CALLBACK (ONE-TIME)
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_API}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: EBAY_RUNAME
      })
    }
  );

  const data = await response.json();

  if (!data.refresh_token) {
    return res.status(500).json(data);
  }

  res.json({
    success: true,
    message: "OAuth success — refresh token generated",
    refresh_token: data.refresh_token
  });
});

/* ===============================
   DEBUG TOKEN
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, token: token.slice(0, 30) + "..." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   DEBUG INVENTORY
================================ */
app.get("/debug/inventory/:sku", async (req, res) => {
  try {
    const sku = req.params.sku;
    const token = await getAccessToken();

    const response = await fetch(
      `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
