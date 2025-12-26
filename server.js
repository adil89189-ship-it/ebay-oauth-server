import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV VARIABLES (REQUIRED)
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REDIRECT_URI, // MUST be real URL
  EBAY_ENV
} = process.env;

/* ===============================
   CONSTANTS
================================ */
const EBAY_AUTH_BASE =
  EBAY_ENV === "production"
    ? "https://auth.ebay.com"
    : "https://auth.sandbox.ebay.com";

const EBAY_TOKEN_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

/* 🔴 YOUR REGISTERED RENAME (DO NOT CHANGE) */
const EBAY_RU_NAME = "warecollection-warecoll-develo-bukuznz";

/* REQUIRED INVENTORY SCOPE */
const EBAY_SCOPE =
  "https://api.ebay.com/oauth/api_scope/sell.inventory";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay OAuth Server Running");
});

/* ===============================
   STEP 1 — START OAUTH
================================ */
app.get("/oauth/start", (req, res) => {
  const authUrl =
    `${EBAY_AUTH_BASE}/oauth2/authorize` +
    `?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(EBAY_RU_NAME)}` +
    `&scope=${encodeURIComponent(EBAY_SCOPE)}`;

  res.redirect(authUrl);
});

/* ===============================
   STEP 2 — OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("❌ Missing authorization code");
  }

  try {
    const authHeader = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(EBAY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: EBAY_REDIRECT_URI // MUST be REAL URL
      })
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(400).json(data);
    }

    /* ⚠️ SAVE refresh_token SECURELY */
    res.json({
      success: true,
      message: "OAuth successful — SAVE refresh_token",
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth token exchange failed");
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
