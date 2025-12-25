import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN;
const EBAY_API_BASE = "https://api.ebay.com";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "eBay OAuth Server Running"
  });
});

/* ===============================
   DEBUG ENV
================================ */
app.get("/debug-env", (req, res) => {
  res.json({
    hasUserToken: !!process.env.EBAY_USER_TOKEN
  });
});

/* ===============================
   VERIFY OAUTH TOKEN (REST API)
   ✅ OAuth-compatible
   ❌ NO Trading API
================================ */
app.get("/verify-oauth-token", async (req, res) => {
  if (!EBAY_USER_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "EBAY_USER_TOKEN missing"
    });
  }

  try {
    const response = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/inventory_item`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Accept": "application/json",
          "Accept-Language": "en-GB"
        }
      }
    );

    const text = await response.text();

    res.status(response.status).send(text);

  } catch (err) {
    console.error("❌ OAuth verification failed:", err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   UPDATE INVENTORY + PRICE
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  const { amazonSku, amazonPrice, quantity } = req.body;

  if (!amazonSku || !amazonPrice || !quantity) {
    return res.status(400).json({
      ok: false,
      error: "Missing amazonSku, amazonPrice, or quantity"
    });
  }

  if (!EBAY_USER_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "Missing EBAY_USER_TOKEN"
    });
  }

  try {
    /* 1️⃣ Update Quantity */
    const invRes = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Accept-Language": "en-GB"
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: {
              quantity
            }
          }
        })
      }
    );

    const invText = await invRes.text();

    if (!invRes.ok) {
      return res.status(400).json({
        ok: false,
        stage: "inventory",
        ebayError: invText
      });
    }

    /* 2️⃣ Get Offer ID */
    const offerRes = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer?sku=${amazonSku}`,
      {
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Accept-Language": "en-GB"
        }
      }
    );

    const offerData = await offerRes.json();

    if (!offerData.offers || !offerData.offers.length) {
      return res.status(400).json({
        ok: false,
        error: "No offer found for SKU"
      });
    }

    const offerId = offerData.offers[0].offerId;

    /* 3️⃣ Update Price */
    const priceRes = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Accept-Language": "en-GB"
        },
        body: JSON.stringify({
          pricingSummary: {
            price: {
              value: amazonPrice,
              currency: "GBP"
            }
          }
        })
      }
    );

    const priceText = await priceRes.text();

    if (!priceRes.ok) {
      return res.status(400).json({
        ok: false,
        stage: "price",
        ebayError: priceText
      });
    }

    res.json({
      ok: true,
      message: "Inventory & price updated successfully"
    });

  } catch (err) {
    console.error("❌ Update failed:", err);
    res.status(500).json({
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
  console.log(`🚀 Server running on port ${PORT}`);
});
