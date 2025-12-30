const fetch = globalThis.fetch;

/* ===============================
   GLOBAL VARIATION LOCK
================================ */
let variationLock = Promise.resolve();

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
export async function reviseListing({ parentItemId, price, quantity, variationName, variationValue }) {
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
     VARIATION LISTING — TARGET EXACT SKU
  ======================= */
  await (variationLock = variationLock.then(async () => {

    const variations = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)];

    let inventoryEntries = [];

    for (const v of variations) {
      const block = v[1];

      if (
        block.includes(`<Name>${variationName}</Name>`) &&
        block.includes(`<Value>${variationValue}</Value>`)
      ) {
        const sku = block.match(/<SKU>(.*?)<\/SKU>/)?.[1];
        if (!sku) throw new Error("Matching variation SKU not found");

        let priceBlock = "";
        if (price !== undefined && price !== null) {
          priceBlock = `<StartPrice>${price}</StartPrice>`;
        }

        inventoryEntries.push(`
<InventoryStatus>
  <SKU>${sku}</SKU>
  ${priceBlock}
  <Quantity>${quantity}</Quantity>
</InventoryStatus>`);
        break;
      }
    }

    if (inventoryEntries.length === 0) {
      throw new Error("Variation match not found in listing");
    }

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<InventoryTrackingMethod>SKU</InventoryTrackingMethod>
${inventoryEntries.join("")}
</ReviseInventoryStatusRequest>`;

    const result = await tradingRequest("ReviseInventoryStatus", xml);
    if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);

  }));
}
