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
   LISTING MODE DETECTOR (SAFE)
================================ */
const listingModeCache = new Map();

async function isManagedBySKU(itemId, token) {
  if (listingModeCache.has(itemId)) return listingModeCache.get(itemId);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
</GetItemRequest>`;

  const res = await tradingRequest("GetItem", xml);
  const managed = res.includes("<InventoryTrackingMethod>SKU</InventoryTrackingMethod>");

  listingModeCache.set(itemId, managed);
  return managed;
}

/* ===============================
   CORE ENGINE — STABLE + FIXED
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const managedBySKU = await isManagedBySKU(parentItemId, token);

  /* ---------------------------------
     1️⃣ UPDATE PRICE (SAFE)
  --------------------------------- */
  if (price !== undefined && price !== null && managedBySKU) {
    const priceXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
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

  /* ---------------------------------
     2️⃣ FORCE ABSOLUTE QUANTITY
     (no drift, respects legacy)
  --------------------------------- */
  const qtyXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <InventoryStatus>
    <ItemID>${parentItemId}</ItemID>
    ${managedBySKU ? `<SKU>${amazonSku}</SKU>` : ""}
    <Quantity>${quantity}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  const result = await tradingRequest("ReviseInventoryStatus", qtyXml);
  if (result.includes("<Ack>Failure</Ack>")) {
    throw new Error(result);
  }
}

/* ===============================
   PUBLIC API — SERIALIZED
================================ */
export async function reviseListing(data) {
  variationLock = variationLock.then(() => _reviseListing(data));
  return variationLock;
}
