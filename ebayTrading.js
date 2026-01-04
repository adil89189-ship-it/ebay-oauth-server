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
   SAFETY SANITIZERS
================================ */
const safePrice = p => Math.max(0.99, Number(p || 0)).toFixed(2);
const safeQty   = q => Math.max(0, parseInt(q || 0, 10));

/* ===============================
   GET FULL ITEM (for variations)
================================ */
async function getItem(parentItemId) {
  const token = process.env.EBAY_TRADING_TOKEN;

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${parentItemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  return tradingRequest("GetItem", xml);
}

/* ===============================
   CORE SYNC ENGINE
================================ */
export async function reviseListing(data) {
  const { parentItemId, amazonSku, price, quantity, variationName, variationValue } = data;
  const token = process.env.EBAY_TRADING_TOKEN;

  const isVariation = variationName && variationValue;

  // 🧬 VARIATION LISTINGS (SAFE & COMPLETE)
  if (isVariation) {
    const itemXML = await getItem(parentItemId);

    const variations = itemXML.match(/<Variation>[\s\S]*?<\/Variation>/g);
    if (!variations) throw new Error("No variations found");

    const rebuilt = variations.map(v => {
      const sku = v.match(/<SKU>(.*?)<\/SKU>/)?.[1];

     return v
  .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${safePrice(sku === amazonSku ? price : v.match(/<StartPrice>(.*?)<\/StartPrice>/)[1])}</StartPrice>`)
  .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${safeQty(sku === amazonSku ? quantity : v.match(/<Quantity>(.*?)<\/Quantity>/)[1])}</Quantity>`);


      return v;
    }).join("");

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>
      ${rebuilt}
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const result = await tradingRequest("ReviseFixedPriceItem", xml);
    if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);

    console.log("🧬 All variations preserved, target updated:", amazonSku);
    return;
  }

  // 📦 SIMPLE LISTINGS
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <StartPrice>${safePrice(price)}</StartPrice>
    <Quantity>${safeQty(quantity)}</Quantity>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);

  console.log("📦 Simple listing updated:", parentItemId);
}
