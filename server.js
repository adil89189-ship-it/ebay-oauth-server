import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN,
  EBAY_ENV,
  EBAY_RUNAME,
  EBAY_REDIRECT_URI
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REFRESH_TOKEN) {
  console.error("❌ Missing required environment variables");
}

/* ===============================
   EBAY BASE URL
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

  const res = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: EBAY_REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  const data = await res.json();

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
   DEBUG TOKEN
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, token: token.slice(0, 25) + "..." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   DEBUG INVENTORY BY SKU
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
