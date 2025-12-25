import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "eBay Inventory OAuth Server Running"
  });
});

/* ===============================
   UPDATE EBAY INVENTORY (OAUTH)
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  const { sku, price, quantity, accessToken } = req.body;

  if (!sku || price === undefined || quantity === undefined || !accessToken) {
    return res.status(400).json({
      ok: false,
      error: "Missing sku, price, quantity, or accessToken"
    });
  }

  try {
    /* ===============================
       1️⃣ UPDATE QUANTITY
    ================================ */
    const qtyResponse = await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: {
              quantity: Number(quantity)
            }
          }
        })
      }
    );

    if (!qtyResponse.ok) {
      return res.status(400).json({
        ok: false,
        stage: "quantity",
        ebayError: await qtyResponse.text()
      });
    }

    /* ===============================
       2️⃣ GET OFFER ID
    ================================ */
    const offerResponse = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer?sku=${sku}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`
        }
      }
    );

    const offerData = await offerResponse.json();

    if (!offerData.offers || offerData.offers.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "No offer found for this SKU"
      });
    }

    const offerId = offerData.offers[0].offerId;

    /* ===============================
       3️⃣ UPDATE PRICE
    ================================ */
    const priceResponse = await fetch(
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
              value: Number(price),
              currency: "GBP"
            }
          }
        })
      }
    );

    if (!priceResponse.ok) {
      return res.status(400).json({
        ok: false,
        stage: "price",
        ebayError: await priceResponse.text()
      });
    }

    /* ===============================
       SUCCESS
    ================================ */
    res.json({
      ok: true,
      message: "Inventory and price updated successfully",
      sku,
      price,
      quantity
    });

  } catch (err) {
    console.error("eBay update error:", err);
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
