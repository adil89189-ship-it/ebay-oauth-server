import fetch from "node-fetch";

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
   SANITIZERS (CRITICAL)
================================ */
function safePrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0.99) return "0.99";
  return n.toFixed(2);
}

function safeQty(q) {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/* ===============================
   CORE SYNC (PARENT)
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku }) {
  const safeP = safePrice(price);
  const safeQ = safeQty(quantity);

  console.log("🧪 SANITIZED:", {
    sku: amazonSku,
    item: parentItemId,
    rawPrice: price,
    safePrice: safeP,
    rawQty: quantity,
    safeQty: safeQ
  });

  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <StartPrice>${safeP}</StartPrice>
    <Quantity>${safeQ}</Quantity>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);

  if (result.includes("<Ack>Failure</Ack>")) {
    throw new Error(result);
  }

  console.log("🟢 Parent listing updated");
}

/* ===============================
   VARIATION PRICE + QUANTITY SYNC
================================ */
export async function reviseVariation(parentItemId, variationSKU, quantity, price, parentPrice) {
  const safeQ = safeQty(quantity);

  const p = Number(price);
  const pp = Number(parentPrice);

  let safeP = Number.isFinite(p) && p >= 0.99 ? p : 0.99;
  if (Number.isFinite(pp) && safeP < pp) safeP = pp;

  safeP = safeP.toFixed(2);

  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>
      <Variation>
        <SKU>${variationSKU}</SKU>
        <StartPrice>${safeP}</StartPrice>
        <Quantity>${safeQ}</Quantity>
      </Variation>
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);

  if (result.includes("<Ack>Failure</Ack>")) {
    throw new Error(result);
  }

  console.log("🧬 Variation price & quantity updated via Trading API:", safeP);
}

/* ===============================
   PUBLIC ENTRY
================================ */
export async function reviseListing(data) {
  return _reviseListing(data);
}
