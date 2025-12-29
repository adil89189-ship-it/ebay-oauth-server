import fetch from "node-fetch";
import { getInventoryToken } from "./inventoryAuth.js";

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

async function getItem(itemId, token) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<ItemID>${itemId}</ItemID>
<DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;
  return tradingRequest("GetItem", xml);
}

async function updateFBEPrice(sku, price) {
  const token = await getInventoryToken();
  const offers = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json());

  if (!offers.offers?.length) throw new Error("No offer found for SKU");

  const offerId = offers.offers[0].offerId;

  await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pricingSummary: { price: { value: price, currency: "GBP" } } })
  });

  await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function reviseListing({ parentItemId, price, quantity, variationName, variationValue }) {
  const token = process.env.EBAY_TRADING_TOKEN;
  const raw = await getItem(parentItemId, token);

  // 🅾️ OOS PARKING RULE (your original working behavior)
  if (quantity === 0) {
    price = 0.99;   // parking price
  }

  // ===== FBE HANDLING =====
  if (raw.includes("<FulfillmentProgram>EBAY_FULFILLMENT</FulfillmentProgram>")) {
    const skuMatch = raw.match(/<SKU>(.*?)<\/SKU>/);
    if (!skuMatch) throw new Error("FBE SKU not found");
    await updateFBEPrice(skuMatch[1], price);
    return { ok: true, success: true };
  }

  // ===== NON-VARIATION =====
  if (!raw.includes("<Variations>")) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<StartPrice>${price}</StartPrice>
<Quantity>${quantity}</Quantity>
</Item>
</ReviseFixedPriceItemRequest>`;
    const result = await tradingRequest("ReviseFixedPriceItem", xml);
    if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
    return { ok: true, success: true };
  }

  // ===== VARIATION =====
  const variationBlocks = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)];

  const rebuiltVariations = variationBlocks.map(v => {
    let block = v[1];
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    const value = block.match(/<Value>(.*?)<\/Value>/)?.[1];

    if (name === variationName && value === variationValue) {
      block = block
        .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`)
        .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);
    }

    return `<Variation>${block}</Variation>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<Variations>
${rebuiltVariations}
</Variations>
</Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);

  return { ok: true, success: true };
}
