import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RU_NAME
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_RU_NAME) {
  console.error("❌ Missing eBay environment variables");
}

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   TOKEN EXCHANGE (AUTH CODE)
================================ */
async function exchangeCode(code, res) {
  if (!code) {
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
    const credentials = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: EBAY_RU_NAME
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: "Token exchange failed",
        details: data
      });
    }

    res.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}

/* ===============================
   REFRESH TOKEN
================================ */
async function refreshAccessToken(refreshToken, res) {
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token missing" });
  }

  try {
    const credentials = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: "Refresh token failed",
        details: data
      });
    }

    res.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}

/* ===============================
   ROUTES
================================ */

// AUTH CODE → TOKEN
app.post("/oauth/exchange", async (req, res) => {
  await exchangeCode(req.body.code, res);
});

app.get("/oauth/exchange", async (req, res) => {
  await exchangeCode(req.query.code, res);
});

// REFRESH TOKEN
app.post("/oauth/refresh", async (req, res) => {
  await refreshAccessToken(req.body.refreshToken, res);
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
