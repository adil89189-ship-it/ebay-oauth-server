import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV Variables
================================ */
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN; // Replace with your eBay token

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

/* ===============================
   INVENTORY UPDATE PLACEHOLDER
================================ */
app.post("/update-inventory", async (req, res) => {
  const { sku, price, quantity } = req.body;
  console.log("📦 Inventory update request:", req.body);

  // Placeholder response
  res.json({
    ok: true,
    message: "Inventory update accepted",
    received: { sku, price, quantity }
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
