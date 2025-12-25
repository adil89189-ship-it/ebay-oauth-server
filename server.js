const express = require("express");
const cors = require("cors");

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
   ROOT / HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   VERIFY EBAY TOKEN (CORRECT)
   Uses Account Privilege API
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  if (!EBAY_USER_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "EBAY_USER_TOKEN missing"
    });
  }

  try {
    const response = await fetch(
      "https://api.ebay.com/sell/account/v1/privilege",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const body = await response.text();

    res.json({
      ok: response.ok,
      status: response.status,
      body
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   404 HANDLER
================================ */
app.use((req, res) => {
  res.status(404).send("Route not found");
});

/* ===============================
   START SERVER (RENDER)
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
