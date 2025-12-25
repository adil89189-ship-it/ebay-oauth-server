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
   EBAY INVENTORY UPDATE (STEP 2)
   Called by Chrome Extension
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, quantity } = req.body;

    // Validate input
    if (!amazonSku || !amazonPrice || !quantity) {
      return res.status(400).json({
        ok: false,
        error: "Missing amazonSku, amazonPrice, or quantity"
      });
    }

    console.log("📦 Inventory update received:", {
      amazonSku,
      amazonPrice,
      quantity
    });

    // 🔵 MOCK SUCCESS (EBAY API WILL BE ADDED NEXT)
    return res.json({
      ok: true,
      message: "Inventory update accepted",
      received: {
        amazonSku,
        amazonPrice,
        quantity
      }
    });

  } catch (err) {
    console.error("❌ Inventory update error:", err);
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
