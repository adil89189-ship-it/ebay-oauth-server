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

async function getItem(itemId) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials>
  <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
</RequesterCredentials>
<ItemID>${itemId}</ItemID>
</GetItemRequest>`;

  return await tradingRequest("GetItem", xml);
}

export async function reviseListing(payload) {
  const raw = await getItem(payload.parentItemId);

  const variations = [...raw.matchAll(/<Variation>[\s\S]*?<\/Variation>/g)].map(v => v[0]);

  const updated = variations.map(v => {
    if (!v.includes(`<SKU>${payload.sku}</SKU>`)) return v;

    return v
      .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${payload.price}</StartPrice>`)
      .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${payload.quantity}</Quantity>`);
  });

  const body = updated.join("");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials>
  <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
</RequesterCredentials>
<Item>
  <ItemID>${payload.parentItemId}</ItemID>
  <Variations>
    ${body}
  </Variations>
</Item>
</ReviseFixedPriceItemRequest>`;

  const response = await tradingRequest("ReviseFixedPriceItem", xml);

  if (response.includes("<Ack>Failure</Ack>")) {
    throw new Error(response);
  }
}
