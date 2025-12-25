import express from "express";
import cors from "cors";

const app = express();

/* ===============================
   MIDDLEWARE
================================ */
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
  res.send("✅ eBay Sync Server Running");
});

/* ===============================
   VERIFY EBAY TOKEN
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.ebay.com/sell/account/v1/fulfillment_policy",
      {
        method: "GET",
        headers: new Headers({
          Authorization: `Bearer ${EBAY_USER_TOKEN}`
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(401).json({
        ok: false,
        error: data
      });
    }

    res.json({
      ok: true,
      message: "Token valid",
      result: data
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   INVENTORY SYNC
================================ */
app.post("/sync-inventory", async (req, res) => {
  try {
    const { sku, price, quantity } = req.body;

    if (!sku || price == null || quantity == null) {
      return res.status(400).json({
        ok: false,
        error: "Missing sku, price, or quantity"
      });
    }

    const payload = {
      availability: {
        shipToLocationAvailability: {
          quantity: Number(quantity)
        }
      },
      pricingSummary: {
        price: {
          value: Number(price),
          currency: "GBP"
        }
      }
    };

    const response = await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
      {
        method: "PUT",
        headers: new Headers({
          Authorization: `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json"
        }),
        body: JSON.stringify(payload)
      }
    );

    const data = await response.text();

    if (!response.ok) {
      return res.status(400).json({
        ok: false,
        stage: "inventory",
        ebayError: data
      });
    }

    res.json({
      ok: true,
      message: "Inventory update accepted",
      received: { sku, price, quantity }
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
