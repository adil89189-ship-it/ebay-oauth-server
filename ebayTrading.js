import { updateOfferQuantity } from "./offerQuantity.js";

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
   HELPERS
================================ */
function safePrice(value) {
  let p = Number(value);
  if (!Number.isFinite(p) || p < 0.99) return null;
  return p.toFixed(2); // always safe for XML
}

function safeQty(value) {
  const q = Number(value);
  return Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 0;
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
   CORE ENGINE — FINAL STABLE
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku, offerId }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const safeP = safePrice(price);
  const safeQ = safeQty(quantity);

  const { isVariation, managedBySKU } = await inspectListing(parentItemId, token);

  /* ===== VARIATION LISTING ===== */
  if (isVariation) {
    const variationXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>
      <Variation>
        <SKU>${amazonSku}</SKU>
        ${safeP ? `<StartPrice>${safeP}</StartPrice>` : ``}
        <Quantity>${safeQ}</Quantity>
      </Variation>
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const res = await tradingRequest("ReviseFixedPriceItem", variationXml);
    if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);

    if (offerId) await updateOfferQuantity(offerId, safeQ);
    return;
  }

  /* ===== NORMAL LISTING — PRICE ===== */
  if (safeP) {
    const priceXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <StartPrice>${safeP}</StartPrice>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const res = await tradingRequest("ReviseFixedPriceItem", priceXml);
    if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);
  }

  /* ===== QUANTITY ===== */
  const qtyXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <InventoryStatus>
    <ItemID>${parentItemId}</ItemID>
    ${managedBySKU ? `<SKU>${amazonSku}</SKU>` : ``}
    <Quantity>${safeQ}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  const res = await tradingRequest("ReviseInventoryStatus", qtyXml);
  if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);

  if (offerId) await updateOfferQuantity(offerId, safeQ);
}

/* ===============================
   PUBLIC API — SERIALIZED
================================ */
export async function reviseListing(data) {
  variationLock = variationLock.then(() => _reviseListing(data));
  return variationLock;
}
