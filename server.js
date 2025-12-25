console.log("ENV CHECK", {
  id: !!process.env.EBAY_CLIENT_ID,
  secret: !!process.env.EBAY_CLIENT_SECRET,
  refresh: !!process.env.EBAY_REFRESH_TOKEN
});
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV VARIABLES
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN
} = process.env;

/* ===============================
   TOKEN CACHE
================================ */
let EBAY_ACCESS_TOKEN = null;
let TOKEN_EXPIRES_AT = 0;

/* ===============================
   REFRESH EBAY ACCESS TOKEN
================================ */
async function refreshEbayToken() {
  if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REFRESH_TOKEN) {
    throw new Error("Missing eBay OAuth environment variables");
  }

  const authHeader =
    "Basic " +
    Buffer.from(
      EBAY_CLIENT_ID + ":" + EBAY_CLIENT_SECRET,
      "utf8"
    ).toString("base64");

  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: [
          "https://api.ebay.com/oauth/api_scope",
          "https://api.ebay.com/oauth/api_scope/sell.inventory",
          "https://api.ebay.com/oauth/api_scope/sell.account"
        ].join(" ")
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  }

  EBAY_ACCESS_TOKEN = data.access_token;
  TOKEN_EXPIRES_AT = Date.now() + data.expires_in * 1000;

  console.log("🔁 eBay access token refreshed");
}

/* ===============================
   ENSURE VALID TOKEN
================================ */
async function ensureValidToken() {
  if (!EBAY_ACCESS_TOKEN || Date.now() > TOKEN_EXPIRES_AT - 60000) {
    await refreshEbayToken();
  }
  return EBAY_ACCESS_TOKEN;
}

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   VERIFY EBAY TOKEN (AUTO REFRESH)
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  try {
    const token = await ensureValidToken();

    const response = await fetch(
      "https://api.ebay.com/sell/account/v1/privilege",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const body = await response.text();

    res.json({
      ok: response.ok,
      status: response.status,
      body
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   404 HANDLER
================================ */
app.use((req, res) => {
  res.status(404).send("Route not found");
});

/* ===============================
   START SERVER (RENDER)
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
