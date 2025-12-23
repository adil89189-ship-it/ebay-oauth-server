/**************************************************
 * eBay OAuth Backend – FINAL (Render Free Plan)
 *
 * FIXES APPLIED:
 * ✅ Forces OLD refresh token to be overwritten
 * ✅ Uses CORRECT inventory scopes
 * ✅ Ensures refresh token NEVER survives scope change
 *
 * IMPORTANT NOTES:
 * - Uses in-memory storage only (Render free-safe)
 * - Restarting Render clears old tokens automatically
 **************************************************/

import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =================================================
   🔥 FORCE RESET TOKEN ON SERVER START
   (This guarantees NO old refresh token survives)
================================================= */
let EBAY_REFRESH_TOKEN = null;

/* =================================================
   HEALTH CHECK
================================================= */
app.get("/", (req, res) => {
  res.send("eBay OAuth backend running (clean state)");
});

/* =================================================
   STEP A — OAUTH EXCHANGE
   Receives authorization code from extension
   Exchanges it for *NEW* refresh token
   ALWAYS OVERWRITES old token
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

    // 🔥 ALWAYS REPLACE OLD REFRESH TOKEN
    EBAY_REFRESH_TOKEN = tokenResponse.data.refresh_token;

    console.log("🆕 NEW REFRESH TOKEN STORED (SCOPES FIXED)");

    res.json({
      success: true,
      message: "OAuth exchange complete — new refresh token issued"
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
   Uses the *NEW* refresh token
   IMPORTANT: Correct inventory scopes applied
================================================= */
app.post("/oauth/refresh", async (req, res) => {
  console.log("🔄 /oauth/refresh called");

  if (!EBAY_REFRESH_TOKEN) {
    return res.status(400).json({
      success: false,
      error: "No refresh token stored — run OAuth again"
    });
  }

  try {
    const tokenResponse = await axios.post(
      "https://api.ebay.com/identity/v1/oauth2/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,

        // 🔑 REQUIRED SCOPES FOR INVENTORY + OFFER UPDATE
        scope: [
          "https://api.ebay.com/oauth/api_scope",
          "https://api.ebay.com/oauth/api_scope/sell.inventory",
          "https://api.ebay.com/oauth/api_scope/sell.account"
        ].join(" ")
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

    console.log("🔑 ACCESS TOKEN GENERATED WITH INVENTORY SCOPE");

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
  console.log(`🚀 Server running on port ${PORT} (clean token state)`);
});
