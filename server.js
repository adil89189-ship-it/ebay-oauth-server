import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay Inventory API Server Running" });
});

/* ===============================
   UPDATE EBAY INVENTORY (OAUTH)
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  const { sku, price, quantity, accessToken } = req.body;

  if (!sku || price == null || quantity == null || !accessToken) {
    return res.status(400).json({
      ok: false,
      error: "Missing sku, price, quantity, or accessToken"
    });
  }

  try {
    /* 1️⃣ Update quantity */
    const qtyRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: { quantity }
          }
        })
      }
    );

    if (!qtyRes.ok) {
      return res.status(400).json({
        ok: false,
        stage: "quantity",
        ebay: await qtyRes.text()
      });
    }

    /* 2️⃣ Get offerId */
    const offerRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`
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

    /* 3️⃣ Update price */
    const priceRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pricingSummary: {
            price: {
              value: price,
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
        ebay: await priceRes.text()
      });
    }

    res.json({
      ok: true,
      message: "Inventory & price updated",
      sku,
      price,
      quantity
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Inventory server running on port ${PORT}`);
});
