import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RU_NAME,
  EBAY_REFRESH_TOKEN
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   HELPER: BASIC AUTH
================================ */
function getBasicAuth() {
  return Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");
}

/* ===============================
   OAUTH: AUTH CODE → TOKEN
================================ */
async function exchangeCode(code, res) {
  if (!code) {
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
    const response = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${getBasicAuth()}`
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
      expiresIn: data.expires_in
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/* ===============================
   POST /oauth/exchange
================================ */
app.post("/oauth/exchange", async (req, res) => {
  await exchangeCode(req.body.code, res);
});

/* ===============================
   GET /oauth/exchange (browser)
================================ */
app.get("/oauth/exchange", async (req, res) => {
  await exchangeCode(req.query.code, res);
});

/* ===============================
   REFRESH TOKEN → ACCESS TOKEN
================================ */
app.get("/oauth/refresh", async (req, res) => {
  if (!EBAY_REFRESH_TOKEN) {
    return res.status(500).json({
      error: "EBAY_REFRESH_TOKEN not set"
    });
  }

  try {
    const response = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${getBasicAuth()}`
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: EBAY_REFRESH_TOKEN,
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
      expiresIn: data.expires_in
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
