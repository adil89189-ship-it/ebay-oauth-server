import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());            // ✅ REQUIRED for Chrome extension
app.use(express.json());    // ✅ REQUIRED to read JSON body

const PORT = process.env.PORT || 10000;

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

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    console.log("ACCESS TOKEN RECEIVED");
    console.log("REFRESH TOKEN RECEIVED");
    console.log("EXPIRES IN:", expires_in);

    // ⚠️ Next step: store refresh_token securely (DB / encrypted storage)

    res.json({ success: true });

  } catch (error) {
    console.error(
      "Token exchange failed:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Token exchange failed" });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
