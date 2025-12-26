import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REDIRECT_URI,
  EBAY_ENV
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REDIRECT_URI) {
  console.error("❌ Missing required environment variables");
}

const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running (OPTION A)");
});

/* ===============================
   START OAUTH
================================ */
app.get("/oauth/start", (req, res) => {
  const scope = encodeURIComponent(
    "https://api.ebay.com/oauth/api_scope " +
    "https://api.ebay.com/oauth/api_scope/sell.inventory " +
    "https://api.ebay.com/oauth/api_scope/sell.account"
  );

  const url =
    `${EBAY_AUTH_URL}?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${EBAY_REDIRECT_URI}` +
    `&scope=${scope}`;

  res.redirect(url);
});

/* ===============================
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: EBAY_REDIRECT_URI
      })
    });

    const data = await response.json();

    if (!data.refresh_token) {
      return res.status(500).json(data);
    }

    console.log("✅ REFRESH TOKEN:", data.refresh_token);

    res.json({
      success: true,
      message: "OAuth success — refresh token generated",
      refresh_token: data.refresh_token
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
