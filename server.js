import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const EBAY_TOKEN = process.env.EBAY_USER_TOKEN;
const EBAY_BASE = "https://api.ebay.com";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "eBay Sync Server Running"
  });
});

/* ===============================
   UPDATE EBAY INVENTORY (REAL)
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, quantity } = req.body;

    if (!amazonSku || !amazonPrice || !quantity) {
      return res.status(400).json({
        ok: false,
        error: "Missing amazonSku, amazonPrice, or quantity"
      });
    }

    if (!EBAY_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Missing eBay OAuth token"
      });
    }

    console.log("📦 Updating eBay SKU:", amazonSku);

    /* ===============================
       1️⃣ UPDATE INVENTORY ITEM
    ================================ */
    const inventoryRes = await fetch(
      `${EBAY_BASE}/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_TOKEN}`,
          "Content-Type": "application/json"
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

    if (!inventoryRes.ok) {
      const text = await inventoryRes.text();
      return res.status(400).json({
        ok: false,
        stage: "inventory",
        ebayError: text
      });
    }

    /* ===============================
       2️⃣ GET OFFER ID
    ================================ */
    const offerRes = await fetch(
      `${EBAY_BASE}/sell/inventory/v1/offer?sku=${amazonSku}`,
      {
        headers: {
          "Authorization": `Bearer ${EBAY_TOKEN}`
        }
      }
    );

    const offerData = await offerRes.json();

    if (!offerData.offers || !offerData.offers.length) {
      return res.status(400).json({
        ok: false,
        error: "No offer found for this SKU"
      });
    }

    const offerId = offerData.offers[0].offerId;

    /* ===============================
       3️⃣ UPDATE PRICE
    ================================ */
    const priceRes = await fetch(
      `${EBAY_BASE}/sell/inventory/v1/offer/${offerId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_TOKEN}`,
          "Content-Type": "application/json"
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

    if (!priceRes.ok) {
      const text = await priceRes.text();
      return res.status(400).json({
        ok: false,
        stage: "price",
        ebayError: text
      });
    }

    return res.json({
      ok: true,
      message: "Inventory & price updated successfully",
      sku: amazonSku,
      price: amazonPrice,
      quantity
    });

  } catch (err) {
    console.error("❌ eBay update error:", err);
    return res.status(500).json({
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
