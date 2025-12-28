import fetch from "node-fetch";
import { getInventoryToken } from "./inventoryAuth.js";

/* ===============================
   TRADING API REQUEST
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
   GET ITEM
================================ */
async function getItem(itemId, token) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<ItemID>${itemId}</ItemID>
<DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  return tradingRequest("GetItem", xml);
}

/* ===============================
   FBE PRICE ENGINE
================================ */
async function updateFBEPrice(sku, price) {
  const token = await getInventoryToken();

  const offers = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json());

  if (!offers.offers || !offers.offers.length)
    throw new Error("No offer found for SKU");

  const offerId = offers.offers[0].offerId;

  await fetch(`https://api.ebay.com/sell/inventory/v1/offer/${offerId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pricingSummary: { price: { value: price, currency: "GBP" } }
    })
  });

  await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer/${offerId}/publish`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
}

/* ===============================
   MAIN ROUTER
================================ */
export async function reviseListing({ parentItemId, price, quantity }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const raw = await getItem(parentItemId, token);

  const isFBE = raw.includes(
    "<FulfillmentProgram>EBAY_FULFILLMENT</FulfillmentProgram>"
  );

  if (isFBE) {
    const skuMatch = raw.match(/<SKU>(.*?)<\/SKU>/);
    if (!skuMatch) throw new Error("FBE SKU not found");

    await updateFBEPrice(skuMatch[1], price);
    return { success: true };
  }

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

  if (!result.includes("<Ack>Success</Ack>")) throw new Error(result);

  return { success: true };
}
