import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

/* ===============================
   SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, quantity } = req.body;

    if (!amazonSku || !amazonPrice || !quantity || !EBAY_USER_TOKEN) {
      return res.status(400).json({
        ok: false,
        error: "Missing sku, price, quantity, or accessToken"
      });
    }

    /* ===============================
       INVENTORY UPDATE
    ================================ */
    const inventoryPayload = {
      availability: {
        shipToLocationAvailability: {
          quantity: Number(quantity)
        }
      }
    };

    const inventoryRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Accept-Language": "en-GB"
        },
        body: JSON.stringify(inventoryPayload)
      }
    );

    const inventoryText = await inventoryRes.text();

    if (!inventoryRes.ok) {
      return res.status(400).json({
        ok: false,
        stage: "inventory",
        ebayError: inventoryText
      });
    }

    /* ===============================
       GET OFFER ID
    ================================ */
    const offerRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer?sku=${amazonSku}`,
      {
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Accept-Language": "en-GB"
        }
      }
    );

    const offerData = await offerRes.json();
    const offerId = offerData.offers?.[0]?.offerId;

    if (!offerId) {
      return res.status(400).json({
        ok: false,
        stage: "offer",
        error: "Offer ID not found"
      });
    }

    /* ===============================
       PRICE UPDATE
    ================================ */
    const pricePayload = {
      pricingSummary: {
        price: {
          value: Number(amazonPrice),
          currency: "GBP"
        }
      }
    };

    const priceRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Accept-Language": "en-GB"
        },
        body: JSON.stringify(pricePayload)
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

    /* ===============================
       SUCCESS
    ================================ */
    res.json({
      ok: true,
      message: "Inventory & price updated",
      received: { amazonSku, amazonPrice, quantity }
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
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
  console.log(`Server running on port ${PORT}`);
});
