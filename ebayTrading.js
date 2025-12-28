import fetch from "node-fetch";

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
   FINAL REVISE ENGINE
================================ */
export async function reviseListing({ parentItemId, variationName, variationValue, price, quantity }) {
  const token = process.env.EBAY_TRADING_TOKEN;
  if (!token) return { success: false, error: "Missing EBAY_TRADING_TOKEN" };

  // Non-variation
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

  // === VARIATION MODE ===
  const rawItem = await getItemDetails(parentItemId, token);
  if (!rawItem.includes("<Variations>")) return { success: false, error: "No variations found" };

  const itemBlock = rawItem.match(/<Item>[\s\S]*?<\/Item>/);
  if (!itemBlock) return { success: false, error: "Item block missing" };

  let itemXML = itemBlock[0];

  const variations = itemXML.match(/<Variation>[\s\S]*?<\/Variation>/g) || [];
  let found = false;

  for (let i = 0; i < variations.length; i++) {
    const v = variations[i];

    if (v.includes(`<Name>${variationName}</Name>`) && v.includes(`<Value>${variationValue}</Value>`)) {
      const updated = v
        .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`)
        .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);

      itemXML = itemXML.replace(v, updated);
      found = true;
      break;
    }
  }

  if (!found) return { success: false, error: "Matching variation not found" };

  const reviseXML = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${token}</eBayAuthToken>
  </RequesterCredentials>
  ${itemXML}
</ReviseFixedPriceItemRequest>`;

  const result = await ebayRequest("ReviseFixedPriceItem", reviseXML);
  if (!result.includes("<Ack>Success</Ack>")) return { success: false, error: result };

  return { success: true };
}
