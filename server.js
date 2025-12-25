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
    message: "eBay Sync Server Running"
  });
});

/* ===============================
   SYNC INVENTORY (MOCK – STEP 1)
   Called by Chrome Extension
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { sku, price, quantity } = req.body;

    // Validate input
    if (!sku || !price || !quantity) {
      return res.status(400).json({
        ok: false,
        error: "Missing sku, price, or quantity"
      });
    }

    console.log("📦 Sync request received:", {
      sku,
      price,
      quantity
    });

    // 🔵 MOCK SUCCESS (NO EBAY API YET)
    return res.json({
      ok: true,
      message: "Mock sync successful",
      received: {
        sku,
        price,
        quantity
      }
    });

  } catch (err) {
    console.error("❌ Sync error:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message
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
