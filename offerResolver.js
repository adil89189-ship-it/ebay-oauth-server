import fetch from "node-fetch";

export async function resolveOfferIdForVariation(parentItemId, variationName, variationValue) {

  // Step 1: Get item variations using Trading API
  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${parentItemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
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

  const text = await res.text();

  // Step 2: Extract correct variation SKU
  const variationBlock = text.match(/<Variation>([\s\S]*?)<\/Variation>/g);
  if (!variationBlock) throw new Error("No variations found");

  let ebayVariationSKU = null;

  for (const block of variationBlock) {
    const name = block.match(new RegExp(`<Name>${variationName}</Name>`));
    const value = block.match(new RegExp(`<Value>${variationValue}</Value>`));

    if (name && value) {
      const skuMatch = block.match(/<SKU>(.*?)<\/SKU>/);
      if (skuMatch) {
        ebayVariationSKU = skuMatch[1];
        break;
      }
    }
  }

  if (!ebayVariationSKU) throw new Error("Matching variation not found");

  // Step 3: Resolve offerId using Inventory API
  const invRes = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(ebayVariationSKU)}`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      }
    }
  );

  const data = await invRes.json();

  if (!data.offers || !data.offers.length) {
    throw new Error(`No offer found for variation SKU ${ebayVariationSKU}`);
  }

  return data.offers[0].offerId;
}
