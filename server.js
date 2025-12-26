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
  EBAY_ENV,
  EBAY_REDIRECT_URI,
  EBAY_REFRESH_TOKEN
} = process.env;

const EBAY_API =
  EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running (OPTION A)");
});

/* ===============================
   OAUTH START
================================ */
app.get("/oauth/start", (req, res) => {
  const scopes = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory"
  ].join(" ");

  const url =
    `${EBAY_API}/identity/v1/oauth2/authorize` +
    `?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(EBAY_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scopes)}`;

  res.redirect(url);
});

/* ===============================
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_API}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: EBAY_REDIRECT_URI
      })
    }
  );

  const data = await response.json();
  console.log("🔐 EBAY OAUTH RESULT:", data);

  if (!data.refresh_token) {
    return res.status(500).json(data);
  }

  res.send(
    "OAuth success. Refresh token printed in server logs."
  );
});

/* ===============================
   ACCESS TOKEN (REFRESH)
================================ */
async function getAccessToken() {
  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_API}/identity/v1/oauth2/token`,
    {
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
    }
  );

  const text = await response.text();
  console.log("🔄 TOKEN REFRESH RESPONSE:", text);

  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("Token refresh failed");
  return data.access_token;
}

/* ===============================
   DEBUG INVENTORY
================================ */
app.get("/debug/inventory/:sku", async (req, res) => {
  try {
    const token = await getAccessToken();
    const sku = req.params.sku;

    const r = await fetch(
      `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("🚀 Server running on port", PORT)
);
