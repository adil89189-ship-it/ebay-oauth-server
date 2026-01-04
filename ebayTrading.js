import fetch from "node-fetch";

let commitLock = Promise.resolve();

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

export async function reviseListing(data) {
  commitLock = commitLock.then(async () => {
    const { parentItemId, price, quantity, variationName, variationValue } = data;

    const reviseXML = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    ${variationName ? `
    <Variations>
      <Variation>
        <StartPrice>${price}</StartPrice>
        <Quantity>${quantity}</Quantity>
        <VariationSpecifics>
          <NameValueList>
            <Name>${variationName}</Name>
            <Value>${variationValue}</Value>
          </NameValueList>
        </VariationSpecifics>
      </Variation>
    </Variations>` : `
    <StartPrice>${price}</StartPrice>
    <Quantity>${quantity}</Quantity>`}
  </Item>
</ReviseFixedPriceItemRequest>`;

    const response = await tradingRequest("ReviseFixedPriceItem", reviseXML);
    console.log("📦 EBAY RESPONSE:", response);
  });

  return commitLock;
}
