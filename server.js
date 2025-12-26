import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   CONFIG
================================ */
const EBAY_OAUTH_TOKEN = process.env.EBAY_OAUTH_TOKEN;
const DEFAULT_QTY = 3;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server Running");
});

/* ===============================
   SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { sku, finalPrice, availability } = req.body;

    if (!sku || !finalPrice || !availability) {
      return res.status(400).json({
        ok: false,
        error: "Missing sku, finalPrice or availability"
      });
    }

    const quantity =
      availability === "out_of_stock" ? 0 : DEFAULT_QTY;

    /* ===== PRICE UPDATE ===== */
    await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}/price`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${EBAY_OAUTH_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          price: { value: finalPrice, currency: "GBP" }
        })
      }
    );

    /* ===== QUANTITY UPDATE ===== */
    await fetch(
      `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${EBAY_OAUTH_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          availability: {
            shipToLocationAvailability: { quantity }
          }
        })
      }
    );

    res.json({
      ok: true,
      message: "Price & quantity synced",
      sku,
      finalPrice,
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
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
