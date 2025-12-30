const fetch = globalThis.fetch;

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
   GET ITEM
================================ */
async function getItem(itemId, token) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<ItemID>${itemId}</ItemID>
<DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;
  return tradingRequest("GetItem", xml);
}

/* ===============================
   REVISE LISTING — FINAL FIX
================================ */
export async function reviseListing({ parentItemId, price, quantity }) {
  const token = process.env.EBAY_TRADING_TOKEN;
  const raw = await getItem(parentItemId, token);

  /* =======================
     SIMPLE LISTING
  ======================= */
  if (!raw.includes("<Variations>")) {
    let priceBlock = "";
    if (price !== undefined && price !== null) {
      priceBlock = `<StartPrice>${price}</StartPrice>`;
    }

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
${priceBlock}
<Quantity>${quantity}</Quantity>
</Item>
</ReviseFixedPriceItemRequest>`;

    const result = await tradingRequest("ReviseFixedPriceItem", xml);
    if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
    return;
  }

  /* =======================
     VARIATION LISTING — CORRECT PATH
     Price + Quantity via ReviseInventoryStatus
  ======================= */
  const variations = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)];

  const inventoryBlocks = variations.map(v => {
    const block = v[1];

    const sku = block.match(/<SKU>(.*?)<\/SKU>/)?.[1];
    if (!sku) return "";

    let priceBlock = "";
    if (price !== undefined && price !== null) {
      priceBlock = `<StartPrice>${price}</StartPrice>`;
    }

    return `
<InventoryStatus>
  <SKU>${sku}</SKU>
  ${priceBlock}
  <Quantity>${quantity}</Quantity>
</InventoryStatus>`;
  }).join("");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
${inventoryBlocks}
</ReviseInventoryStatusRequest>`;

  const result = await tradingRequest("ReviseInventoryStatus", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
}
