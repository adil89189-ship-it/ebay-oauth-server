const fetch = globalThis.fetch;

/* ===============================
   GLOBAL LOCK — prevents races
================================ */
let variationLock = Promise.resolve();

/* ===============================
   EBAY LOW LEVEL REQUEST
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
   LISTING INSPECTOR (CACHED)
================================ */
const listingCache = new Map();

async function inspectListing(itemId, token) {
  if (listingCache.has(itemId)) return listingCache.get(itemId);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
</GetItemRequest>`;

  const res = await tradingRequest("GetItem", xml);

  const isVariation = res.includes("<Variations>");
  const managedBySKU = res.includes("<InventoryTrackingMethod>SKU</InventoryTrackingMethod>");

  const info = { isVariation, managedBySKU };
  listingCache.set(itemId, info);
  return info;
}

/* ===============================
   CORE ENGINE — FINAL
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku, variationName, variationValue, offerId }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const { isVariation, managedBySKU } = await inspectListing(parentItemId, token);

  /* =================================================
     VARIATION LISTINGS (ALL TYPES, INCLUDING FBE)
  ================================================= */
  if (isVariation) {
    const variationXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>
      <Variation>
        <SKU>${amazonSku}</SKU>
        ${price !== undefined && price !== null ? `<StartPrice>${price}</StartPrice>` : ``}
        <Quantity>${quantity}</Quantity>
        <VariationSpecifics>
          <NameValueList>
            <Name>${variationName}</Name>
            <Value>${variationValue}</Value>
          </NameValueList>
        </VariationSpecifics>
      </Variation>
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const res = await tradingRequest("ReviseFixedPriceItem", variationXml);
    if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);
    return;
  }

  /* =================================================
     NON-VARIATION LISTINGS
  ================================================= */

  if (price !== undefined && price !== null && managedBySKU) {
    const priceXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <StartPrice>${price}</StartPrice>
  </Item>
</ReviseFixedPriceItemRequest>`;

    await tradingRequest("ReviseFixedPriceItem", priceXml);
  }

  const qtyXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <InventoryStatus>
    <ItemID>${parentItemId}</ItemID>
    ${managedBySKU ? `<SKU>${amazonSku}</SKU>` : ``}
    <Quantity>${quantity}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  const res = await tradingRequest("ReviseInventoryStatus", qtyXml);
  if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);
}

/* ===============================
   PUBLIC API — SERIALIZED
================================ */
export async function reviseListing(data) {
  variationLock = variationLock.then(() => _reviseListing(data));
  return variationLock;
}
