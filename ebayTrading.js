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

export async function reviseListing({
  parentItemId,
  price,
  quantity,
  variationKey,
  variationName,
  variationValue
}) {
  if (!variationKey && variationName && variationValue) {
    variationKey = `${variationName.replace(/\.$/, "")}. ${variationValue}`;
  }

  console.log("🚀 REVISE CALLED:", { parentItemId, price, quantity, variationKey });

  const token = process.env.EBAY_TRADING_TOKEN;
  const raw = await getItem(parentItemId, token);

  if (raw.includes("<FulfillmentProgram>EBAY_FULFILLMENT</FulfillmentProgram>")) {
    const skuMatch = raw.match(/<SKU>(.*?)<\/SKU>/);
    if (!skuMatch) throw new Error("FBE SKU not found");
    await updateFBEPrice(skuMatch[1], price);
    return { success: true };
  }

  if (!variationKey || !raw.includes("<Variations>")) {
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
    return { success: true };
  }

  const [attrName, attrValue] = variationKey.split(".").map(v => v.trim());

  const variations = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)].map(v => v[1]);

  let target = null;
  for (const v of variations) {
    const name = v.match(/<Name>(.*?)<\/Name>/)?.[1];
    const value = v.match(/<Value>(.*?)<\/Value>/)?.[1];
    if (name === attrName && value === attrValue) {
      target = v;
      break;
    }
  }

  if (!target) {
    console.log("⚠️ VARIATION NOT FOUND:", variationKey);
    return { success: false, error: "Variation not found" };
  }

  const sku = target.match(/<SKU>(.*?)<\/SKU>/)?.[1];
  if (!sku) throw new Error("Missing variation SKU");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<Variations>
<Variation>
<SKU>${sku}</SKU>
<VariationSpecifics>
<NameValueList><Name>${attrName}</Name><Value>${attrValue}</Value></NameValueList>
</VariationSpecifics>
<StartPrice>${price}</StartPrice>
<Quantity>${quantity}</Quantity>
</Variation>
</Variations>
</Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  console.log("🔎 EBAY VARIATION RESPONSE:\n", result);

  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);

  return { success: true };
}
