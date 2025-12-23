import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
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
   TOKEN EXCHANGE ENDPOINT
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

    const {
      access_token,
      refresh_token,
      expires_in
    } = tokenResponse.data;

    // =========================
    // STORE REFRESH TOKEN SAFELY
    // =========================
    const dataToStore = {
      refresh_token,
      obtained_at: Date.now(),
      expires_in
    };

    fs.writeFileSync(TOKEN_FILE, JSON.stringify(dataToStore, null, 2));

    console.log("✅ REFRESH TOKEN STORED SUCCESSFULLY");

    res.json({
      success: true,
      message: "Refresh token stored securely"
    });

  } catch (error) {
    console.error(
      "❌ Token exchange failed:",
      error.response?.data || error.message
    );

    res.status(500).json({ error: "Token exchange failed" });
  }
});

/* ========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
