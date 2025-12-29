export async function reviseListing({ parentItemId, price, quantity, variationName, variationValue }) {
  const token = process.env.EBAY_TRADING_TOKEN;

  // 🔒 AUTO-DS OOS RULE — FINAL & UNBREAKABLE
  let finalPrice = price;
  let finalQty   = quantity;

  if (quantity <= 0 || price === 0.99) {
    finalPrice = 0.99;   // parking price (eBay-safe)
    finalQty   = 0;      // true OOS trigger
  }

  const raw = await getItem(parentItemId, token);

  // ===== NON-VARIATION =====
  if (!raw.includes("<Variations>")) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<StartPrice>${finalPrice}</StartPrice>
<Quantity>${finalQty}</Quantity>
</Item>
</ReviseFixedPriceItemRequest>`;

    const result = await tradingRequest("ReviseFixedPriceItem", xml);
    if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
    return;
  }

  // ===== VARIATION =====
  const variationBlocks = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)];

  const rebuiltVariations = variationBlocks.map(v => {
    let block = v[1];
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    const value = block.match(/<Value>(.*?)<\/Value>/)?.[1];

    if (name === variationName && value === variationValue) {
      block = block
        .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${finalPrice}</StartPrice>`)
        .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${finalQty}</Quantity>`);
    }

    return `<Variation>${block}</Variation>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<Variations>
${rebuiltVariations}
</Variations>
</Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);
  if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
}
