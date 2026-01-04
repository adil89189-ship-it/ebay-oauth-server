import fetch from "node-fetch";

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

const safePrice = p => Math.max(0.99, Number(p || 0)).toFixed(2);
const safeQty = q => Math.max(0, parseInt(q || 0, 10));

export async function reviseListing({ parentItemId, price, quantity }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <StartPrice>${safePrice(price)}</StartPrice>
    <Quantity>${safeQty(quantity)}</Quantity>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
}

export async function reviseVariation(parentItemId, sku, quantity, price) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>
      <Variation>
        <SKU>${sku}</SKU>
        <StartPrice>${safePrice(price)}</StartPrice>
        <Quantity>${safeQty(quantity)}</Quantity>
      </Variation>
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
}
