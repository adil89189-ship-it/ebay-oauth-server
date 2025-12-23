import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.options("*", cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const TOKEN_FILE = "./ebay_tokens.json";

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("eBay OAuth backend running");
});

/* =========================
   STEP A — OAUTH EXCHANGE
========================= */
app.post("/oauth/exchange", async (req, res) => {
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

    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify(
        {
          refresh_token,
          obtained_at: Date.now(),
          expires_in
        },
        null,
        2
      )
    );

    console.log("✅ REFRESH TOKEN STORED");

    res.json({ success: true });

  } catch (error) {
    console.error("❌ OAuth exchange failed:", error.response?.data || error.message);
    res.status(500).json({ error: "OAuth exchange failed" });
  }
});

/* =========================
   STEP B — ACCESS TOKEN REFRESH (POST)
========================= */
app.post("/oauth/refresh", async (req, res) => {
  if (!fs.existsSync(TOKEN_FILE)) {
    return res.status(400).json({ error: "No refresh token stored" });
  }

  const { refresh_token } = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));

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

    console.log("🔑 ACCESS TOKEN GENERATED");

    res.json({
      success: true,
      expires_in: tokenResponse.data.expires_in
    });

  } catch (error) {
    console.error("❌ Access token refresh failed:", error.response?.data || error.message);
    res.status(500).json({ error: "Access token refresh failed" });
  }
});

/* =========================
   DEBUG CONFIRMATION (FREE PLAN SAFE)
========================= */
app.get("/debug/refresh", async (req, res) => {
  if (!fs.existsSync(TOKEN_FILE)) {
    return res.json({ error: "No refresh token stored" });
  }

  const { refresh_token } = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));

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

    console.log("🔑 ACCESS TOKEN GENERATED (DEBUG)");

    res.json({
      success: true,
      expires_in: tokenResponse.data.expires_in
    });

  } catch (error) {
    res.json({
      error: error.response?.data || error.message
    });
  }
});

/* ========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
