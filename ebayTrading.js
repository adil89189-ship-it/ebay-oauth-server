const fetch = globalThis.fetch;

/* ===============================
   GLOBAL LOCK
================================ */
let variationLock = Promise.resolve();

/* ===============================
   EBAY REQUEST
================================ */
async function tradingRequest(callName, xml) {
  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1445",
      "X-EBAY-API-APP-NAME": process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-DEV-NAME": process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-CERT-NAME": process.env.EBAY_CLIENT_SECRET
    },
    body: xml
  });
  return res.text();
}

/* ===============================
   CORE ENGINE
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  // 1️⃣ Price update (safe)
  if (price !== undefined && price !== null) {
     const trackingXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<InventoryTrackingMethod>SKU</InventoryTrackingMethod>
</Item>
</ReviseFixedPriceItemRequest>`;

await tradingRequest("ReviseFixedPriceItem", trackingXml);
    const priceXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<Variations>
<Variation>
<SKU>${amazonSku}</SKU>
<StartPrice>${price}</StartPrice>
</Variation>
</Variations>
</Item>
</ReviseFixedPriceItemRequest>`;
    await tradingRequest("ReviseFixedPriceItem", priceXml);
  }

  // 2️⃣ Absolute quantity overwrite (correct way)
  const qtyXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<InventoryStatus>
<ItemID>${parentItemId}</ItemID>
<SKU>${amazonSku}</SKU>
<Quantity>${quantity}</Quantity>
</InventoryStatus>
</ReviseInventoryStatusRequest>`;

  const result = await tradingRequest("ReviseInventoryStatus", qtyXml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
}

/* ===============================
   PUBLIC API
================================ */
export async function reviseListing(data) {
  variationLock = variationLock.then(() => _reviseListing(data));
  return variationLock;
}
