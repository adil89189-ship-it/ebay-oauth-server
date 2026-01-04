import fetch from "node-fetch";

const ENDPOINT = "https://api.ebay.com/ws/api.dll";

/* ===============================
   LOW LEVEL EBAY REQUEST
================================ */
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

/* ===============================
   FETCH FULL VARIATION SET
================================ */
async function getItem(itemId) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials>
  <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
</RequesterCredentials>
<ItemID>${itemId}</ItemID>
</GetItemRequest>`;

  return tradingRequest("GetItem", xml);
}

/* ===============================
   AUTHORITATIVE SYNC ENGINE
================================ */
export async function reviseListing({ parentItemId, sku, price, quantity }) {

  const raw = await getItem(parentItemId);

  const variations = [...raw.matchAll(/<Variation>[\s\S]*?<\/Variation>/g)]
    .map(v => v[0]);

  const updated = variations.map(v => {
    if (!v.includes(`<SKU>${sku}</SKU>`)) return v;

    return v
      .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`)
      .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials>
  <eBayAuthToken>${process.env.EBAY_TRADING_TOKEN}</eBayAuthToken>
</RequesterCredentials>
<Item>
  <ItemID>${parentItemId}</ItemID>
  <Variations>
    ${updated.join("")}
  </Variations>
</Item>
</ReviseFixedPriceItemRequest>`;

  const res = await tradingRequest("ReviseFixedPriceItem", xml);

  if (res.includes("<Ack>Failure</Ack>")) {
    throw new Error(res);
  }
}
