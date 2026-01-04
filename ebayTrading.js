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
   HELPERS
================================ */
const safePrice = p => Math.max(0.99, Number(p || 0)).toFixed(2);
const safeQty   = q => Math.max(0, parseInt(q || 0, 10));

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>(.*?)</${name}>`));
  return m ? m[1] : "";
}

/* ===============================
   GET FULL ITEM
================================ */
async function getItem(itemId) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  return tradingRequest("GetItem", xml);
}

/* ===============================
   CORE ENGINE
================================ */
export async function reviseListing(data) {
  const { parentItemId, amazonSku, price, quantity, variationName } = data;

  const itemXML = await getItem(parentItemId);
  const variations = itemXML.match(/<Variation>[\s\S]*?<\/Variation>/g);
  if (!variations) throw new Error("No variations found");

  const rebuilt = variations.map(v => {
    const sku = tag(v, "SKU");

    const finalPrice = sku === amazonSku ? safePrice(price) : safePrice(tag(v, "StartPrice"));
    const finalQty   = sku === amazonSku ? safeQty(quantity) : safeQty(tag(v, "Quantity"));

    return `
<Variation>
  <SKU>${sku}</SKU>
  <StartPrice>${finalPrice}</StartPrice>
  <Quantity>${finalQty}</Quantity>
  ${tag(v, "VariationSpecifics")}
</Variation>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>
      ${rebuilt}
    </Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);

  console.log("🧬 Independent pricing locked. Target updated:", amazonSku);
}
