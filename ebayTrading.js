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

    const parentItemId   = xmlSafe(data.parentItemId);
    const variationName  = xmlSafe(data.variationName);
    const variationValue = xmlSafe(data.variationValue);
    const sku            = xmlSafe(data.sku);
    let quantity         = Number(data.quantity ?? 0);

    // 🔒 ENFORCE VALID PRICE FOR EBAY
    let rawPrice = Number(data.price);
    let validPrice = rawPrice > 0 && Number.isFinite(rawPrice)
      ? Number(rawPrice.toFixed(2))
      : 0.99; // ← CRITICAL FIX: never allow missing StartPrice

    const isVariation = variationName && variationValue;

    if (isVariation && !sku) {
      throw new Error("Variation SKU missing. Cannot update variation listing.");
    }

    let body = "";

    // 🔹 SIMPLE LISTING
    if (!isVariation) {
      body = `
        <StartPrice>${validPrice}</StartPrice>
        <Quantity>${quantity}</Quantity>
      `;
    }

    // 🔸 VARIATION LISTING
    if (isVariation) {
      const specificsXML = `
        <VariationSpecifics>
          <NameValueList>
            <Name>${variationName}</Name>
            <Value>${variationValue}</Value>
          </NameValueList>
        </VariationSpecifics>`;

      body = `
        <Variations>
          <Variation>
            <SKU>${sku}</SKU>
            <StartPrice>${validPrice}</StartPrice>
            <Quantity>${quantity}</Quantity>
            ${specificsXML}
          </Variation>
        </Variations>
      `;
    }

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
