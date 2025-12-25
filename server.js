import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   CONFIG
========================= */
const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const TOKEN_FILE = "./ebay_tokens.json";

/* =========================
   TOKEN HELPERS
========================= */
function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKEN_FILE));
}

/* =========================
   OAUTH: EXCHANGE CODE
========================= */
app.post("/exchange-token", async (req, res) => {
  const { code } = req.body;

  try {
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RUNAME
      })
    });

    const data = await response.json();

    if (!data.refresh_token) {
      return res.status(400).json({ error: "Refresh token missing" });
    }

    saveTokens(data);

    res.json({
      success: true,
      message: "eBay connected securely"
    });
  } catch (err) {
    res.status(500).json({ error: "Token exchange failed" });
  }
});

/* =========================
   GET FRESH ACCESS TOKEN
========================= */
async function getAccessToken() {
  const tokens = loadTokens();
  if (!tokens?.refresh_token) throw new Error("No refresh token");

  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const newToken = await response.json();
  tokens.access_token = newToken.access_token;
  saveTokens(tokens);

  return newToken.access_token;
}

/* =========================
   HEALTH CHECK
========================= */
app.get("/status", (req, res) => {
  const tokens = loadTokens();
  res.json({
    ebayConnected: !!tokens?.refresh_token
  });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("eBay OAuth server running on port", PORT);
});
