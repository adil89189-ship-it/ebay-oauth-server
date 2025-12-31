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
   REVISE LISTING — EBAY-SAFE FINAL ENGINE
================================ */
export async function reviseListing({ parentItemId, price, quantity, variationName, variationValue }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  // 1️⃣ Load full item
  const raw = await getItem(parentItemId, token);

  // =======================
  // SIMPLE LISTING
  // =======================
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

  // =======================
  // VARIATION LISTING — EBAY SAFE UPDATE
  // =======================
  const variations = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)];

  let found = false;

  const rebuiltVariations = variations.map(v => {
    let block = v[1];

    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    const value = block.match(/<Value>(.*?)<\/Value>/)?.[1];

    if (name === variationName && value === variationValue) {
      found = true;

      // Price
      if (block.includes("<StartPrice>")) {
        block = block.replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`);
      } else {
        block = block.replace("</VariationSpecifics>", `</VariationSpecifics><StartPrice>${price}</StartPrice>`);
      }

      // Quantity
      if (block.includes("<Quantity>")) {
        block = block.replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);
      } else {
        block = block.replace("</StartPrice>", `</StartPrice><Quantity>${quantity}</Quantity>`);
      }
    }

    return block;   // 👈 DO NOT wrap here
  });

  if (!found) throw new Error("Target variation not found on listing");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<Variations>
${rebuiltVariations.map(v => `<Variation>${v}</Variation>`).join("\n")}
</Variations>
</Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
}
