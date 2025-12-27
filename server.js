import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/sync", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  const token = process.env.EBAY_TRADING_TOKEN;
  if (!token) return res.json({ ok:false, error:"Missing Trading Token" });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
  <ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
      <eBayAuthToken>${token}</eBayAuthToken>
    </RequesterCredentials>
    <Item>
      <ItemID>${itemId}</ItemID>
      <StartPrice>${price}</StartPrice>
      <Quantity>${quantity}</Quantity>
    </Item>
  </ReviseFixedPriceItemRequest>`;

  const r = await fetch("https://api.ebay.com/ws/api.dll", {
    method:"POST",
    headers:{
      "Content-Type":"text/xml",
      "X-EBAY-API-CALL-NAME":"ReviseFixedPriceItem",
      "X-EBAY-API-SITEID":"3",
      "X-EBAY-API-COMPATIBILITY-LEVEL":"967"
    },
    body: xml
  });

  const data = await r.text();
  res.send(data);
});

app.listen(10000, () => console.log("Server running"));
