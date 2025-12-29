export async function reviseListing({ parentItemId, price, quantity, variationName, variationValue }) {
  const token = process.env.EBAY_TRADING_TOKEN;
  const raw = await getItem(parentItemId, token);

  // ===== FBE HANDLING =====
  if (raw.includes("<FulfillmentProgram>EBAY_FULFILLMENT</FulfillmentProgram>")) {
    const skuMatch = raw.match(/<SKU>(.*?)<\/SKU>/);
    if (!skuMatch) throw new Error("FBE SKU not found");
    await updateFBEPrice(skuMatch[1], price);
    return { ok: true, success: true };
  }

  // ===== NON-VARIATION =====
  if (!raw.includes("<Variations>")) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
<Item>
<ItemID>${parentItemId}</ItemID>
<StartPrice>${price}</StartPrice>
<Quantity>${quantity}</Quantity>
</Item>
</ReviseFixedPriceItemRequest>`;
    const result = await tradingRequest("ReviseFixedPriceItem", xml);
    if (result.includes("<Ack>Failure</Ack>")) throw new Error(result);
    return { ok: true, success: true };
  }

  // ===== VARIATION =====
  const variationBlocks = [...raw.matchAll(/<Variation>([\s\S]*?)<\/Variation>/g)];

  const rebuiltVariations = variationBlocks.map(v => {
    let block = v[1];
    const name = block.match(/<Name>(.*?)<\/Name>/)?.[1];
    const value = block.match(/<Value>(.*?)<\/Value>/)?.[1];

    if (name === variationName && value === variationValue) {
      block = block
        .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`)
        .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);
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

  return { ok: true, success: true };
}
