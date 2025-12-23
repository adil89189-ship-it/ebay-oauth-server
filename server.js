/**************************************************
 * eBay OAuth Backend – FINAL (Render Free Plan)
 * Step A: OAuth Code → Refresh Token
 * Step B: Refresh Token → Access Token
 *
 * IMPORTANT:
 * - Uses in-memory ENV storage (Render free-safe)
 * - Filesystem is NOT reliable on free plan
 **************************************************/

import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());              // ✅ Allow extension/browser requests
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =================================================
   HEALTH CHECK
================================================= */
app.get("/", (req, res) => {
  res.send("eBay OAuth backend running");
});

/* =================================================
   STEP A — OAUTH EXCHANGE
   Receives authorization code from extension
   Exchanges it for refresh token
   Stores refresh token IN MEMORY (ENV)
================================================= */
app.post("/oauth/exchange", async (req, res) => {
  console.log("📩 /oauth/exchange called");

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
    const tokenResponse = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RUNAME
      }),
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

    const { refresh_token, expires_in } = tokenResponse.data;

    // ✅ STORE REFRESH TOKEN (FREE PLAN SAFE)
    process.env.EBAY_REFRESH_TOKEN = refresh_token;

    console.log("✅ REFRESH TOKEN STORED IN MEMORY");

    res.json({
      success: true,
      step: "Step A complete — refresh token stored",
      expires_in
    });

  } catch (error) {
    console.error(
      "❌ OAuth exchange failed:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "OAuth exchange failed" });
  }
});

/* =================================================
   STEP B — ACCESS TOKEN REFRESH
   Uses stored refresh token
   Generates short-lived access token
================================================= */
app.post("/oauth/refresh", async (req, res) => {
  console.log("🔄 /oauth/refresh called");

  const refresh_token = process.env.EBAY_REFRESH_TOKEN;

  if (!refresh_token) {
    return res.status(400).json({
      error: "No refresh token stored (Step A not completed or server restarted)"
    });
  }

  try {
    const tokenResponse = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
        scope: "https://api.ebay.com/oauth/api_scope"
      }),
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

    console.log("🔑 ACCESS TOKEN GENERATED SUCCESSFULLY");

    res.json({
      success: true,
      access_token: tokenResponse.data.access_token,
      expires_in: tokenResponse.data.expires_in
    });

  } catch (error) {
    console.error(
      "❌ Access token refresh failed:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Access token refresh failed" });
  }
});

/* ================================================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
