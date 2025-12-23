/**************************************************
 * eBay OAuth + Inventory Sync Backend (FINAL)
 * Platform: Render (Free Plan Safe)
 *
 * Endpoints:
 * POST /oauth/exchange     → stores refresh token
 * POST /oauth/refresh      → returns access token
 * POST /sync/inventory     → updates eBay listing
 **************************************************/

import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* =================================================
   HEALTH CHECK
================================================= */
app.get("/", (req, res) => {
  res.send("✅ eBay backend running");
});

/* =================================================
   STEP A — AUTH CODE → REFRESH TOKEN
================================================= */
app.post("/oauth/exchange", async (req, res) => {
  console.log("📩 /oauth/exchange");

  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
    const response = await axios.post(
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

    process.env.EBAY_REFRESH_TOKEN = response.data.refresh_token;

    console.log("✅ Refresh token stored in memory");

    res.json({ success: true });
  } catch (err) {
    console.error("❌ OAuth exchange failed", err.response?.data || err.message);
    res.status(500).json({ error: "OAuth exchange failed" });
  }
});

/* =================================================
   STEP B — REFRESH TOKEN → ACCESS TOKEN
================================================= */
async function getAccessToken() {
  const refreshToken = process.env.EBAY_REFRESH_TOKEN;
  if (!refreshToken) throw new Error("No refresh token stored");

  const response = await axios.post(
    "https://api.ebay.com/identity/v1/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/sell.inventory"
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

  return response.data.access_token;
}

/* =================================================
   MAIN SYNC ENDPOINT (USED BY EXTENSION)
================================================= */
app.post("/sync/inventory", async (req, res) => {
  console.log("🔄 /sync/inventory called");

  const { amazonSku, amazonPrice, multiplier, inStock } = req.body;

  if (!amazonSku || !amazonPrice || !multiplier) {
    return res.status(400).json({ error: "Missing sync data" });
  }

  const EBAY_SKU = `AMZ-${amazonSku}`;
  const quantity = inStock ? 3 : 0;
  const price = +(amazonPrice * multiplier).toFixed(2);

  try {
    const accessToken = await getAccessToken();

    /* ---------- INVENTORY ITEM ---------- */
    await axios.put(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${EBAY_SKU}`,
      {
        availability: {
          shipToLocationAvailability: { quantity }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("📦 Inventory item updated");

    /* ---------- GET OFFER ---------- */
    const offerRes = await axios.get(
      `https://api.ebay.com/sell/inventory/v1/offer?sku=${EBAY_SKU}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!offerRes.data.offers?.length) {
      return res.status(404).json({ error: "No offer found for SKU" });
    }

    const offerId = offerRes.data.offers[0].offerId;
    console.log("🆔 Offer ID:", offerId);

    /* ---------- UPDATE OFFER ---------- */
    await axios.put(
      `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
      {
        pricingSummary: {
          price: { value: price, currency: "GBP" }
        },
        availableQuantity: quantity
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    /* ---------- PUBLISH OFFER ---------- */
    await axios.post(
      `https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    console.log("🎉 Offer published successfully");

    res.json({
      success: true,
      sku: EBAY_SKU,
      price,
      quantity
    });

  } catch (err) {
    console.error("❌ Sync failed", err.response?.data || err.message);
    res.status(500).json({ error: "Inventory sync failed" });
  }
});

/* ================================================= */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
