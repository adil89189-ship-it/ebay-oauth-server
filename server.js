import express from "express";
import fetch from "node-fetch";
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
  EBAY_REFRESH_TOKEN,
  EBAY_ENV
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REFRESH_TOKEN) {
  console.error("❌ Missing required environment variables");
}

/* ===============================
   EBAY URLS
================================ */
const EBAY_OAUTH_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

const EBAY_INVENTORY_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/sell/inventory/v1/inventory_item"
    : "https://api.sandbox.ebay.com/sell/inventory/v1/inventory_item";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running (INVENTORY)");
});

/* ===============================
   DEBUG — TOKEN
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const auth = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(EBAY_OAUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
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

    const tokenRes = await fetch(EBAY_OAUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
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

    const testRes = await fetch(EBAY_INVENTORY_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json"
      }
    });

    if (testRes.status === 403) {
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
   TEST — INVENTORY UPDATE
================================ */
app.post("/sync/test", async (req, res) => {
  try {
    const { sku, price, quantity } = req.body;

    if (!sku || price == null || quantity == null) {
      return res.status(400).json({
        ok: false,
        error: "sku, price and quantity are required"
      });
    }

    const auth = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    // Refresh token
    const tokenRes = await fetch(EBAY_OAUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
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

    // Inventory update
    const invRes = await fetch(
      `${EBAY_INVENTORY_URL}/${sku}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sku,
          availability: {
            shipToLocationAvailability: {
              quantity
            }
          },
          price: {
            value: price,
            currency: "GBP"
          }
        })
      }
    );

    const invData = await invRes.json();

    if (!invRes.ok) {
      return res.status(invRes.status).json({
        ok: false,
        error: "Inventory update failed",
        invData
      });
    }

    res.json({
      ok: true,
      message: "Inventory updated successfully",
      sku,
      price,
      quantity
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
