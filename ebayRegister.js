import { updateOfferQuantity } from "./offerQuantity.js";

const fetch = globalThis.fetch;

/* ===============================
   GLOBAL SERIALIZATION LOCK
================================ */
let variationLock = Promise.resolve();

/* ===============================
   EBAY HARD THROTTLE HANDLER
================================ */
let lastCallTime = 0;

async function safeTradingRequest(callName, xml) {
  const now = Date.now();
  const wait = Math.max(0, 1200 - (now - lastCallTime));
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastCallTime = Date.now();

  const res = await tradingRequest(callName, xml);

  if (res.includes("<ErrorCode>10007</ErrorCode>")) {
    await new Promise(r => setTimeout(r, 2500));
    return tradingRequest(callName, xml);
  }

  return res;
}

/* ===============================
   XML ESCAPE — FINAL FIX
================================ */
function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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
  <ItemID>${xmlEscape(itemId)}</ItemID>
</GetItemRequest>`;

  const res = await safeTradingRequest("GetItem", xml);

  const variationCount = (res.match(/<Variation>/g) || []).length;
  const isVariation = variationCount > 1;
  const managedBySKU = res.includes("<InventoryTrackingMethod>SKU</InventoryTrackingMethod>");

  const info = { isVariation, managedBySKU };
  listingCache.set(itemId, info);
  return info;
}

/* ===============================
   CORE SYNC ENGINE
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku, offerId, variationName, variationValue }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const safeQty = Number.isFinite(Number(quantity)) ? Math.max(0, Number(quantity)) : 0;

  const { isVariation, managedBySKU } = await inspectListing(parentItemId, token);

  const hasVariationData =
    variationName && variationValue &&
    String(variationName).trim() !== "" &&
    String(variationValue).trim() !== "";

  /* ===== VARIATION UPDATE ===== */
  if (isVariation && hasVariationData) {
    const variationXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${xmlEscape(parentItemId)}</ItemID>
    <Variations>
      <Variation>
        <SKU>${xmlEscape(amazonSku)}</SKU>
        <VariationSpecifics>
          <NameValueList>
            <Name>${xmlEscape(variationName)}</Name>
            <Value>${xmlEscape(variationValue)}</Value>
          </NameValueList>
        </VariationSpecifics>
        ${price !== undefined && price !== null ? `<StartPrice>${price}</StartPrice>` : ``}
        <Quantity>${safeQty}</Quantity>
      </Variation>
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const res = await safeTradingRequest("ReviseFixedPriceItem", variationXml);
    if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);

    if (offerId) await updateOfferQuantity(offerId, safeQty);
    return;
  }

  /* ===== NORMAL PRICE UPDATE ===== */
  if (price !== undefined && price !== null) {
    const priceXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${xmlEscape(parentItemId)}</ItemID>
    <StartPrice>${price}</StartPrice>
    <ListingDetails>
      <ConvertedStartPrice>${price}</ConvertedStartPrice>
    </ListingDetails>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const res = await safeTradingRequest("ReviseFixedPriceItem", priceXml);
    if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);
  }

  /* ===== QUANTITY UPDATE ===== */
  const qtyXml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <InventoryStatus>
    <ItemID>${xmlEscape(parentItemId)}</ItemID>
    ${managedBySKU ? `<SKU>${xmlEscape(amazonSku)}</SKU>` : ``}
    <Quantity>${safeQty}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  const res = await safeTradingRequest("ReviseInventoryStatus", qtyXml);
  if (res.includes("<Ack>Failure</Ack>")) throw new Error(res);

  if (offerId) await updateOfferQuantity(offerId, safeQty);
}

/* ===============================
   PUBLIC ENTRY (SERIALIZED)
================================ */
export async function reviseListing(data) {
  variationLock = variationLock.then(() => _reviseListing(data));
  return variationLock;
}
