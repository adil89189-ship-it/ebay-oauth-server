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

if (!EBAY_USER_TOKEN) {
  console.error("❌ EBAY_USER_TOKEN is missing");
}

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

/* ===============================
   PRICE + QTY UPDATE (ITEM ID)
================================ */
app.post("/sync", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  if (!itemId || price == null || quantity == null) {
    return res.status(400).json({
      error: "Missing itemId, price or quantity"
    });
  }

  if (!EBAY_USER_TOKEN) {
    return res.status(500).json({
      error: "eBay user token not configured"
    });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_USER_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <InventoryStatus>
    <ItemID>${itemId}</ItemID>
    <StartPrice>${price}</StartPrice>
    <Quantity>${quantity}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  try {
    const response = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "ReviseInventoryStatus",
        "X-EBAY-API-SITEID": "3",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
      },
      body: xml
    });

    const text = await response.text();
    console.log("📦 eBay response:", text);

    if (!response.ok) {
      return res.status(500).json({
        error: "eBay API error",
        details: text
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Sync failed:", err);
    res.status(500).json({ error: "eBay update failed" });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
