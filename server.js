import express from "express";
import cors from "cors";

const app = express();

/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

/* ===============================
   UPDATE INVENTORY (TEST MODE)
================================ */
app.post("/ebay/update-inventory", (req, res) => {
  try {
    const { amazonSku, amazonPrice, quantity } = req.body;

    console.log("📥 Inventory update request received:", req.body);

    if (!amazonSku || !amazonPrice) {
      return res.status(400).json({
        ok: false,
        error: "Missing amazonSku or amazonPrice"
      });
    }

    // 🚧 TEST MODE — no eBay API yet
    return res.json({
      ok: true,
      message: "Inventory update accepted (test mode)",
      received: {
        amazonSku,
        amazonPrice,
        quantity
      }
    });

  } catch (err) {
    console.error("❌ Inventory update failed:", err);
    res.status(500).json({
      ok: false,
      error: "Server error"
    });
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
