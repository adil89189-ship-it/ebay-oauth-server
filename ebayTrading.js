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
   CORE SYNC
================================ */
async function _reviseListing({ parentItemId, price, quantity, amazonSku, offerId }) {

  const safeP = safePrice(price);
  const safeQ = safeQty(quantity);

  // 🔍 Diagnostic log you requested
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
  console.error("❌ SYNC ERROR:", result);
} else {
  console.log("🟢 SYNC RESULT: OK");
}

  return result;
}

/* ===============================
   PUBLIC ENTRY
================================ */
export async function reviseListing(data) {
  return _reviseListing(data);
}
