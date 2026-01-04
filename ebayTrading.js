import fetch from "node-fetch";

const ENDPOINT = "https://api.ebay.com/ws/api.dll";

async function tradingRequest(callName, xml) {
  const res = await fetch(ENDPOINT, {
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

export async function reviseListing({ parentItemId, sku, price, quantity, variationName, variationValue }) {

  const xml = `<?xml version="1.0" encoding="utf-8"?>
  <ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
      <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
    </RequesterCredentials>
    <Item>
      <ItemID>${parentItemId}</ItemID>
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
      </Variations>
    </Item>
  </ReviseFixedPriceItemRequest>`;

  const response = await tradingRequest("ReviseFixedPriceItem", xml);

  if (response.includes("<Ack>Failure</Ack>")) {
    throw new Error(response);
  }
}
