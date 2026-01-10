import fetch from "node-fetch";

let commitLock = Promise.resolve();

function xmlSafe(v){
  return String(v ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&apos;");
}

function tradingRequest(callName, xml){
  return fetch("https://api.ebay.com/ws/api.dll",{
    method:"POST",
    headers:{
      "Content-Type":"text/xml",
      "X-EBAY-API-CALL-NAME":callName,
      "X-EBAY-API-SITEID":"3",
      "X-EBAY-API-COMPATIBILITY-LEVEL":"1445",
      "X-EBAY-API-APP-NAME":process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-DEV-NAME":process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-CERT-NAME":process.env.EBAY_CLIENT_SECRET
    },
    body:xml
  }).then(r=>r.text());
}

export async function reviseListing(data){
  commitLock = commitLock.then(async()=>{

    const parentItemId = xmlSafe(data.parentItemId);
    const variationName = xmlSafe(data.variationName);
    const variationValue = xmlSafe(data.variationValue);
    const sku = xmlSafe(data.sku);

    const quantity = Number(data.quantity ?? 0);
    let price = Number(data.price);
    if (!Number.isFinite(price) || price <= 0) price = 0.99;

    const isVariation = variationName && variationValue;

    let body = "";

    if (!isVariation) {
      body = `
        <StartPrice>${price.toFixed(2)}</StartPrice>
        <Quantity>${quantity}</Quantity>
        <OutOfStockControl>false</OutOfStockControl>
      `;
    }

    if (isVariation) {
      body = `
        <Variations>
          <Variation>
            <SKU>${sku}</SKU>
            <StartPrice>${price.toFixed(2)}</StartPrice>
            <Quantity>${quantity}</Quantity>
            <VariationSpecifics>
              <NameValueList>
                <Name>${variationName}</Name>
                <Value>${variationValue}</Value>
              </NameValueList>
            </VariationSpecifics>
          </Variation>
        </Variations>
        <OutOfStockControl>false</OutOfStockControl>
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
