import fetch from "node-fetch";

let commitLock = Promise.resolve();

function xmlSafe(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

async function getItemInfo(itemId) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const response = await tradingRequest("GetItem", xml);
  return {
    isEnded: /<ListingStatus>Completed<\/ListingStatus>/.test(response),
    isVariation: /<Variations>/.test(response)
  };
}

export async function reviseListing(data) {
  commitLock = commitLock.then(async () => {
    const src = data.payload || data;

    const parentItemId = xmlSafe(src.parentItemId || src.ebayParentItemId);
    const variationName = xmlSafe(src.variationName || "");
    const variationValue = xmlSafe(src.variationValue || "");
    const sku = xmlSafe(src.amazonSku || "");
    const quantity = Number(src.quantity);
    const price = Number(src.price);

    const info = await getItemInfo(parentItemId);
    if (info.isEnded) return;

    let body = "";

    if (!info.isVariation) {
      body += `<Quantity>${quantity}</Quantity>`;
      if (quantity > 0 && Number.isFinite(price)) {
        body += `<StartPrice>${price}</StartPrice>`;
      }
    } else {
      body += `
        <Variations>
          <Variation>
            <SKU>${sku}</SKU>
            <Quantity>${quantity}</Quantity>`;
      if (quantity > 0 && Number.isFinite(price)) {
        body += `<StartPrice>${price}</StartPrice>`;
      }
      if (variationName && variationValue) {
        body += `
            <VariationSpecifics>
              <NameValueList>
                <Name>${variationName}</Name>
                <Value>${variationValue}</Value>
              </NameValueList>
            </VariationSpecifics>`;
      }
      body += `</Variation></Variations>`;
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
