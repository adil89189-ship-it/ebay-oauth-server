require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let REFRESH_TOKEN = null;

app.get("/", (req, res) => {
  res.send("eBay OAuth server running (secure mode)");
});

/* =========================
   OAuth Exchange (SECURE)
========================= */
app.post("/exchange-token", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });

  try {
    const basicAuth = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RUNAME
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`
        }
      }
    );

    // 🔐 STORE REFRESH TOKEN SECURELY
    REFRESH_TOKEN = response.data.refresh_token;

    console.log("✅ Refresh token stored securely");

    // ❌ DO NOT return tokens to extension
    res.json({ success: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "OAuth failed" });
  }
});

/* =========================
   Get Access Token (Internal)
========================= */
async function getAccessToken() {
  if (!REFRESH_TOKEN) throw new Error("No refresh token stored");

  const basicAuth = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`
      }
    }
  );

  return response.data.access_token;
}

/* =========================
   TEST ENDPOINT
========================= */
app.get("/test-token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ token_valid: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("eBay OAuth server running securely on port", PORT);
});
