import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server Online");
});

/* ===============================
   MAIN SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { itemId, price, quantity } = req.body;

    if (!itemId || typeof price !== "number" || typeof quantity !== "number") {
      return res.json({ ok: false, error: "Invalid payload" });
    }

    const token = process.env.EBAY_TRADING_TOKEN;
    if (!token) {
      return res.json({ ok: false, error: "Missing EBAY_TRADING_TOKEN" });
    }

    const safePrice = Math.max(Number(price.toFixed(2)), 0.99);

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${itemId}</ItemID>
    <StartPrice>${safePrice}</StartPrice>
    <Quantity>${quantity}</Quantity>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const response = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
        "X-EBAY-API-SITEID": "3",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
      },
      body: xml
    });

    const raw = await response.text();

    return res.json({ ok: true, ebayResponse: raw });

  } catch (err) {
    console.error("SYNC ERROR:", err);
    return res.json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on ${PORT}`);
});
