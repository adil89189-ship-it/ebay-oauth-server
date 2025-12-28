import fetch from "node-fetch";

/* ===============================
   INTERNAL EBAY REQUEST
================================ */
async function ebayRequest(callName, xml) {
  const response = await fetch("https://api.ebay.com/ws/api.dll", {
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

  return response.text();
}

/* ===============================
   GET FULL ITEM
================================ */
async function getItemDetails(itemId, token) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  return ebayRequest("GetItem", xml);
}

/* ===============================
   REVISE ENGINE
================================ */
export async function reviseListing({ parentItemId, variationName, variationValue, price, quantity }) {
  const token = process.env.EBAY_TRADING_TOKEN;
  if (!token) return { success: false, error: "Missing EBAY_TRADING_TOKEN" };

  // Simple listing
  if (!variationName || !variationValue) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <StartPrice>${price}</StartPrice>
    <Quantity>${quantity}</Quantity>
  </Item>
</ReviseFixedPriceItemRequest>`;

    const raw = await ebayRequest("ReviseFixedPriceItem", xml);
    if (!raw.includes("<Ack>Success</Ack>")) return { success: false, error: raw };
    return { success: true };
  }

  // Variation listing
  const rawItem = await getItemDetails(parentItemId, token);
  if (!rawItem.includes("<Variations>")) return { success: false, error: "No variations found" };

  const blocks = rawItem.match(/<Variation>([\s\S]*?)<\/Variation>/g) || [];
  let target = null;

  for (const block of blocks) {
    if (
      block.includes(`<Name>${variationName}</Name>`) &&
      block.includes(`<Value>${variationValue}</Value>`)
    ) {
      target = block;
      break;
    }
  }

  if (!target) return { success: false, error: "Matching variation not found" };

  const updated = target
    .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`)
    .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);

  const revisedXML = rawItem
    .replace(target, updated)
    .replace("<GetItemResponse", "<ReviseFixedPriceItemRequest")
    .replace("</GetItemResponse>", "</ReviseFixedPriceItemRequest>");

  const result = await ebayRequest("ReviseFixedPriceItem", revisedXML);
  if (!result.includes("<Ack>Success</Ack>")) return { success: false, error: result };

  return { success: true };
}
