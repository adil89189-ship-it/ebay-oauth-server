import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RUNAME
} = process.env;

/* ===============================
   TOKEN STORAGE (DEV → STEP 2 READY)
================================ */
let ebayAccessToken = null;
let ebayRefreshToken = null;
let tokenExpiry = 0;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay OAuth Server Running" });
});

/* ===============================
   START EBAY OAUTH
================================ */
app.get("/auth/ebay", (req, res) => {
  const scope = encodeURIComponent(
    "https://api.ebay.com/oauth/api_scope " +
    "https://api.ebay.com/oauth/api_scope/sell.inventory"
  );

  const authUrl =
    `https://auth.ebay.com/oauth2/authorize` +
    `?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${EBAY_RUNAME}` +
    `&scope=${scope}`;

  res.redirect(authUrl);
});

/* ===============================
   OAUTH CALLBACK
   (STEP 1: STORE REFRESH TOKEN)
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ ok: false, error: "No authorization code" });
  }

  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: EBAY_RUNAME
        })
      }
    );

    const data = await tokenRes.json();

    if (!data.access_token || !data.refresh_token) {
      return res.status(400).json({ ok: false, error: data });
    }

    ebayAccessToken = data.access_token;
    ebayRefreshToken = data.refresh_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;

    res.json({
      ok: true,
      message: "Authorization successful (refresh token stored)"
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   STEP 2: AUTO REFRESH TOKEN
================================ */
async function getValidEbayToken() {
  if (ebayAccessToken && Date.now() < tokenExpiry - 60000) {
    return ebayAccessToken;
  }

  if (!ebayRefreshToken) {
    throw new Error("No refresh token available");
  }

  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: ebayRefreshToken,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    }
  );

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to refresh eBay token");
  }

  ebayAccessToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return ebayAccessToken;
}

/* ===============================
   STEP 3: AUTHENTICATED SYNC
================================ */
app.post("/sync", async (req, res) => {
  try {
    await getValidEbayToken();

    res.json({
      ok: true,
      message: "Inventory update accepted",
      received: req.body
    });
  } catch (err) {
    res.status(401).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
