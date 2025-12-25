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
    message: "eBay OAuth Sync Server Running"
  });
});

/* ===============================
   VERIFY OAUTH TOKEN
================================ */
app.get("/verify-oauth-token", async (req, res) => {
  try {
    const r = await fetch(`${EBAY_API_BASE}/sell/inventory/v1/inventory_item`, {
      headers: {
        Authorization: `Bearer ${EBAY_USER_TOKEN}`,
        Accept: "application/json"
      }
    });

    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===============================
   UPDATE INVENTORY + PRICE
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  const { amazonSku, amazonPrice, quantity } = req.body;

  if (!amazonSku || amazonPrice == null || quantity == null) {
    return res.status(400).json({
      ok: false,
      error: "Missing amazonSku, amazonPrice, or quantity"
    });
  }

  try {
    /* 1️⃣ UPDATE QUANTITY */
    const invRes = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Language": "en-GB"
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: { quantity }
          }
        })
      }
    );

    if (!invRes.ok) {
      return res.status(400).json({
        ok: false,
        stage: "inventory",
        ebayError: await invRes.text()
      });
    }

    /* 2️⃣ GET OFFER ID */
    const offerRes = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer?sku=${amazonSku}`,
      {
        headers: {
          Authorization: `Bearer ${EBAY_USER_TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    const offerData = await offerRes.json();

    if (!offerData.offers?.length) {
      return res.status(400).json({
        ok: false,
        error: "No offer found for SKU"
      });
    }

    const offerId = offerData.offers[0].offerId;

    /* 3️⃣ UPDATE PRICE */
    const priceRes = await fetch(
      `${EBAY_API_BASE}/sell/inventory/v1/offer/${offerId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Language": "en-GB"
        },
        body: JSON.stringify({
          marketplaceId: "EBAY_GB",
          pricingSummary: {
            price: {
              value: amazonPrice,
              currency: "GBP"
            }
          }
        })
      }
    );

    if (!priceRes.ok) {
      return res.status(400).json({
        ok: false,
        stage: "price",
        ebayError: await priceRes.text()
      });
    }

    res.json({
      ok: true,
      message: "Inventory and price updated successfully"
    });

  } catch (err) {
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
