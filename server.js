import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV VARIABLES (REQUIRED)
================================ */
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Trading API Sync Server Running");
});

/* ===============================
   SYNC ROUTE (EXISTING LISTINGS)
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { itemId, price, quantity } = req.body;

    if (!itemId || price === undefined || quantity === undefined) {
      return res.status(400).json({
        ok: false,
        error: "Missing itemId, price or quantity"
      });
    }

    if (!EBAY_USER_TOKEN) {
      return res.status(401).json({
        ok: false,
        error: "EBAY_USER_TOKEN not configured"
      });
    }

    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
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

    const ebayRes = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "ReviseInventoryStatus",
        "X-EBAY-API-SITEID": "3",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-APP-NAME": EBAY_APP_ID,
        "X-EBAY-API-DEV-NAME": EBAY_DEV_ID,
        "X-EBAY-API-CERT-NAME": EBAY_CERT_ID
      },
      body: xmlBody
    });

    const responseText = await ebayRes.text();

    if (!responseText.includes("<Ack>Success</Ack>")) {
      return res.status(500).json({
        ok: false,
        error: "eBay Trading API error",
        raw: responseText
      });
    }

    res.json({
      ok: true,
      message: "Inventory updated successfully",
      itemId,
      price,
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
  console.log("Trading API server running on port", PORT);
});
