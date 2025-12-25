import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const {
  EBAY_ACCESS_TOKEN
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay Sync Server Running" });
});

/* ===============================
   UPDATE EBAY INVENTORY
================================ */
app.post("/sync", async (req, res) => {
  const { sku, price, quantity } = req.body;

  if (!sku || !price || quantity === undefined) {
    return res.status(400).json({
      ok: false,
      error: "Missing sku, price or quantity"
    });
  }

  try {
    /* ==========================
       STEP 1: Get OFFER ID
    ========================== */
    const offerRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`,
      {
        headers: {
          "Authorization": `Bearer ${EBAY_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const offerData = await offerRes.json();

    if (!offerData.offers || !offerData.offers.length) {
      return res.status(404).json({
        ok: false,
        error: "No eBay offer found for this SKU"
      });
    }

    const offerId = offerData.offers[0].offerId;

    /* ==========================
       STEP 2: UPDATE PRICE & QTY
    ========================== */
    const updateRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          availableQuantity: quantity,
          pricingSummary: {
            price: {
              value: price,
              currency: "GBP"
            }
          }
        })
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return res.status(400).json({
        ok: false,
        error: "eBay update failed",
        details: errText
      });
    }

    res.json({
      ok: true,
      message: "eBay price & quantity updated",
      sku,
      price,
      quantity
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "Server error",
      message: err.message
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
