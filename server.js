import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Sync Engine LIVE"));

/* ===============================
   MAIN SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const data = { ...req.body };

    if (data.price === null || data.quantity === 0) {
      data.quantity = 0;
    }

    // ✅ Single source of truth: Trading API only
    await reviseListing(data);

    console.log("🟢 SYNC RESULT: OK");
    res.json({ ok: true, success: true });
  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
    res.json({ ok: false, success: false, error: err.message });
  }
});

/* ===============================
   🔎 TEMP DEBUG — VERIFY EBAY STATE
================================ */
app.get("/check/:itemId", async (req, res) => {
  const itemId = req.params.itemId;
  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials>
  <eBayAuthToken>${token}</eBayAuthToken>
</RequesterCredentials>
<ItemID>${itemId}</ItemID>
<DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const response = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetItem",
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1445",
      "X-EBAY-API-APP-NAME": process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-DEV-NAME": process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-CERT-NAME": process.env.EBAY_CLIENT_SECRET
    },
    body: xml
  });

  const text = await response.text();
  res.type("xml").send(text);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🟢 Server running on ${PORT}`));
