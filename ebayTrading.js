import fetch from "node-fetch";

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

export async function reviseListing(data) {
  const { parentItemId, amazonSku, price, quantity } = data;
  const token = process.env.EBAY_TRADING_TOKEN;

  const itemXML = await getItem(parentItemId);

  const variations = itemXML.match(/<Variation>[\s\S]*?<\/Variation>/g);
  if (!variations) throw new Error("No variations found");

  const rebuilt = variations.map(v => {
    const sku = v.match(/<SKU>(.*?)<\/SKU>/)?.[1];

    let out = v;

    if (sku === amazonSku) {
      out = out
        .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${safePrice(price)}</StartPrice>`)
        .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${safeQty(quantity)}</Quantity>`);
    }

    return out;
  }).join("");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
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
}
