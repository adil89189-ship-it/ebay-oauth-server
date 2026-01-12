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

/* ===============================
   GET EXISTING VARIATION PRICE
================================ */
export async function getCurrentVariationPrice(parentItemId, variationName, variationValue){

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${parentItemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const response = await tradingRequest("GetItem", xml);

  const escName = variationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escVal  = variationValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const match = response.match(
    new RegExp(
      `<Variation>[\\s\\S]*?<Name>${escName}</Name>[\\s\\S]*?<Value>${escVal}</Value>[\\s\\S]*?<StartPrice[^>]*>([0-9.]+)</StartPrice>`
    )
  );

  if (!match) return null;

  return Number(match[1]);
}

/* ===============================
   REVISE LISTING — PRODUCTION SAFE
================================ */
export async function reviseListing(data){

  commitLock = commitLock.then(async()=>{

    const src = data.payload || data;

    const parentItemId = xmlSafe(
      src.parentItemId ||
      src.ebayParentItemId ||
      src.parentItemID ||
      src.ebayParentID
    );

    if (!parentItemId) {
      console.error("❌ RAW DATA:", JSON.stringify(data, null, 2));
      throw new Error("Missing eBay ItemID — cannot revise listing");
    }

    const variationName  = xmlSafe(src.variationName);
    const variationValue = xmlSafe(src.variationValue);
    const sku            = xmlSafe(src.sku);

    const quantity = Number(src.quantity);
    const price    = Number(src.price);
    const isVariation = variationName && variationValue;

    let body = "";

    if (!isVariation) {

      body += `<Quantity>${quantity}</Quantity>`;

      if (quantity > 0 && Number.isFinite(price)) {
        body += `<StartPrice>${price}</StartPrice>`;
      }

    } else {

      body += `
        <Variations>
          <Variation>
            <SKU>${sku}</SKU>
            <Quantity>${quantity}</Quantity>
      `;

      if (quantity > 0 && Number.isFinite(price)) {
        body += `<StartPrice>${price}</StartPrice>`;
      }

      body += `
            <VariationSpecifics>
              <NameValueList>
                <Name>${variationName}</Name>
                <Value>${variationValue}</Value>
              </NameValueList>
            </VariationSpecifics>
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
