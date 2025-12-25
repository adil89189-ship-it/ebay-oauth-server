require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===============================
// MEMORY STORE (TEMP – OK FOR NOW)
// ===============================
let refreshToken = null;

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("eBay OAuth Server is running ✅");
});

// ===============================
// STEP 1: START EBAY OAUTH
// ===============================
app.get("/auth/ebay", (req, res) => {
  const scope = [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.account"
  ].join(" ");

  const authUrl =
    "https://auth.ebay.com/oauth2/authorize" +
    `?client_id=${process.env.EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${process.env.EBAY_RUNAME}` +
    `&scope=${encodeURIComponent(scope)}`;

  res.redirect(authUrl);
});

// ===============================
// STEP 2: OAUTH CALLBACK
// ===============================
app.get("/auth/ebay/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing auth code");

  try {
    const tokenRes = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RUNAME
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
            ).toString("base64")
        }
      }
    );

    refreshToken = tokenRes.data.refresh_token;

    res.send("✅ eBay connected successfully. You can close this window.");
  } catch (err) {
    console.error("OAuth Error:", err.response?.data || err.message);
    res.status(500).send("OAuth failed");
  }
});

// ===============================
// STEP 3: REFRESH ACCESS TOKEN
// ===============================
async function getAccessToken() {
  if (!refreshToken) throw new Error("No refresh token stored");

  const res = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
          ).toString("base64")
      }
    }
  );

  return res.data.access_token;
}

// ===============================
// TEST ENDPOINT
// ===============================
app.get("/test-token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===============================
// START SERVER (RENDER REQUIRED)
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
