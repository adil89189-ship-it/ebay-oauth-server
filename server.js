import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/* =========================
   GLOBAL TOKEN STORAGE
   (OK for now – later we move to DB)
========================= */
let EBAY_REFRESH_TOKEN = null;
let EBAY_ACCESS_TOKEN = null;
let EBAY_ACCESS_EXPIRY = 0;

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("eBay OAuth server running");
});

/* =========================
   STEP 1: START EBAY OAUTH
========================= */
app.get("/auth/ebay", (req, res) => {
  const authUrl =
    "https://auth.ebay.com/oauth2/authorize?" +
    new URLSearchParams({
      client_id: process.env.EBAY_CLIENT_ID,
      response_type: "code",
      redirect_uri: process.env.EBAY_RU_NAME, // MUST be RuName, NOT URL
      scope:
        "https://api.ebay.com/oauth/api_scope " +
        "https://api.ebay.com/oauth/api_scope/sell.inventory"
    }).toString();

  res.redirect(authUrl);
});

/* =========================
   STEP 2: EBAY CALLBACK
========================= */
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
            ).toString("base64")
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.EBAY_RU_NAME
        })
      }
    );

    const data = await tokenRes.json();

    if (!data.refresh_token) {
      console.error("❌ OAuth failed:", data);
      return res.status(500).json(data);
    }

    EBAY_REFRESH_TOKEN = data.refresh_token;
    EBAY_ACCESS_TOKEN = data.access_token;
    EBAY_ACCESS_EXPIRY = Date.now() + data.expires_in * 1000;

    console.log("🟢 eBay refresh token stored successfully");

    res.send(
      "eBay connected successfully. You can close this tab and return to the extension."
    );
  } catch (err) {
    console.error("❌ OAuth callback error:", err);
    res.status(500).send("OAuth callback failed");
  }
});

/* =========================
   ACCESS TOKEN REFRESH
========================= */
async function getAccessToken() {
  if (EBAY_ACCESS_TOKEN && Date.now() < EBAY_ACCESS_EXPIRY - 60000) {
    return EBAY_ACCESS_TOKEN;
  }

  if (!EBAY_REFRESH_TOKEN) {
    throw new Error("No refresh token stored");
  }

  const res = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
          ).toString("base64")
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    }
  );

  const data = await res.json();

  EBAY_ACCESS_TOKEN = data.access_token;
  EBAY_ACCESS_EXPIRY = Date.now() + data.expires_in * 1000;

  return EBAY_ACCESS_TOKEN;
}

/* =========================
   TEST ENDPOINT
========================= */
app.get("/map-offers", async (req, res) => {
  try {
    await getAccessToken();
    res.json({ status: "OK", message: "Refresh token is valid" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`eBay OAuth server running on port ${PORT}`);
});
