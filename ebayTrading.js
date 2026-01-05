import fetch from "node-fetch";

/* ===============================
   GLOBAL COMMIT LOCK
================================ */
let commitLock = Promise.resolve();

/* ===============================
   XML SAFETY
================================ */
function xmlSafe(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* ===============================
   EBAY LOW LEVEL REQUEST
================================ */
function tradingRequest(callName, xml) {
  return fetch("https://api.ebay.com/ws/api.dll", {
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
  }).then(r => r.text());
}

/* ===============================
   MAIN REVISION ENGINE
================================ */
export async function reviseListing(data) {
  commitLock = commitLock.then(async () => {

    const parentItemId  = xmlSafe(data.parentItemId);
    const price         = xmlSafe(data.price);
    const quantity      = xmlSafe(data.quantity);
    const variationName = xmlSafe(data.variationName);
    const variationValue= xmlSafe(data.variationValue);
    const sku           = xmlSafe(data.sku);

    // 🚫 HARD BLOCK: Never send item-level price/qty for variation listings
    if (!variationName || !variationValue || !sku) {
      throw new Error("Variation data missing. Refusing to send item-level price/quantity.");
    }

    const body = `
    <Variations>
      <Variation>
        <SKU>${sku}</SKU>
        <StartPrice>${price}</StartPrice>
        <Quantity>${quantity}</Quantity>
        <VariationSpecifics>
          <NameValueList>
            <Name>${variationName}</Name>
            <Value>${variationValue}</Value>
          </NameValueList>
        </VariationSpecifics>
      </Variation>
    </Variations>`;

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    ${body}
  </Item>
</ReviseFixedPriceItemRequest>`;

    const response = await tradingRequest("ReviseFixedPriceItem", xml);
    console.log("📦 EBAY RESPONSE:", response);
  });

  return commitLock;
}
