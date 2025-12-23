import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors()); // 🔴 REQUIRED
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

    const { refresh_token } = tokenResponse.data;

    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify({ refresh_token, saved_at: new Date() }, null, 2)
    );

    console.log("✅ REFRESH TOKEN STORED");

    res.json({ success: true });

  } catch (err) {
    console.error("❌ TOKEN EXCHANGE ERROR:", err.response?.data || err.message);
    res.status(500).json({ error: "Token exchange failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
