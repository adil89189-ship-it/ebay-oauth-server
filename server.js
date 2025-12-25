const express = require("express");
const cors = require("cors");

const app = express(); // ✅ app defined BEFORE use

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
  res.send("eBay Sync Server Running");
});

/* ===============================
   VERIFY EBAY TOKEN (NO XML)
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  if (!EBAY_USER_TOKEN) {
    return res.status(500).json({ error: "EBAY_USER_TOKEN missing" });
  }

  try {
    const response = await fetch("https://api.ebay.com/sell/inventory/v1/inventory_item", {
      headers: {
        Authorization: `Bearer ${EBAY_USER_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    res.json({
      ok: response.ok,
      status: response.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
