import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV CHECK
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN,
  EBAY_ENV
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REFRESH_TOKEN) {
  console.error("❌ Missing required environment variables");
}

/* ===============================
   EBAY ENDPOINTS
================================ */
const EBAY_OAUTH_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

const EBAY_INVENTORY_TEST =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/sell/inventory/v1/inventory_item"
    : "https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running");
});

/* ===============================
   DEBUG — TOKEN REFRESH
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const auth = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(EBAY_OAUTH_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    });

    const data = await response.json();

    if (!data.access_token) {
      return res.status(400).json({
        ok: false,
        error: "Token refresh failed",
        data
      });
    }

    res.json({
      ok: true,
      access_token_generated: true,
      expires_in: data.expires_in
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   DEBUG — INVENTORY ACCESS
================================ */
app.get("/debug/inventory", async (req, res) => {
  try {
    const auth = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    // 1. Refresh token
    const tokenRes = await fetch(EBAY_OAUTH_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: "Token refresh failed", tokenData });
    }

    // 2. Inventory API permission test
    const invRes = await fetch(EBAY_INVENTORY_TEST, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      }
    });

    if (invRes.status === 403) {
      return res.status(403).json({
        ok: false,
        error: "Inventory access denied"
      });
    }

    res.json({
      ok: true,
      inventory_access: "granted"
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
