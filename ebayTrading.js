import fetch from "node-fetch";

/* ===============================
   GET FULL EBAY ITEM
================================ */
async function getItemDetails(itemId, userToken) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${userToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "GetItem",
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
    },
    body: xml
  });

  return res.text();
}

/* ===============================
   MAIN VARIATION ENGINE
================================ */
export async function reviseListing({ parentItemId, variationName, variationValue, price, quantity }) {
  const userToken = process.env.EBAY_TRADING_TOKEN;
  if (!userToken) return { success: false, error: "Missing EBAY_TRADING_TOKEN" };

  // If no variation → normal update
  if (!variationName || !variationValue) {
    return reviseSimpleItem(parentItemId, price, quantity, userToken);
  }

  const raw = await getItemDetails(parentItemId, userToken);
  if (!raw.includes("<Variations>")) return { success: false, error: "Listing has no variations" };

  const matchBlock = raw.match(/<Variation>([\s\S]*?)<\/Variation>/g);

  let targetBlock = null;

  for (const block of matchBlock || []) {
    if (
      block.includes(`<Name>${variationName}</Name>`) &&
      block.includes(`<Value>${variationValue}</Value>`)
    ) {
      targetBlock = block;
      break;
    }
  }

  if (!targetBlock) return { success: false, error: "Matching variation not found" };

  const newBlock = targetBlock
    .replace(/<StartPrice>.*?<\/StartPrice>/, `<StartPrice>${price}</StartPrice>`)
    .replace(/<Quantity>.*?<\/Quantity>/, `<Quantity>${quantity}</Quantity>`);

  const revisedXML = raw.replace(targetBlock, newBlock)
    .replace("<GetItemResponse", "<ReviseFixedPriceItemRequest")
    .replace("</GetItemResponse>", "</ReviseFixedPriceItemRequest>");

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
    },
    body: revisedXML
  });

  const result = await res.text();

  if (!result.includes("<Ack>Success</Ack>")) {
    return { success: false, error: result };
  }

  return { success: true };
}

/* ===============================
   SIMPLE ITEM UPDATE
================================ */
async function reviseSimpleItem(itemId, price, quantity, userToken) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${userToken}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${itemId}</ItemID>
    <StartPrice>${price}</StartPrice>
    <Quantity>${quantity}</Quantity>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const response = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
    },
    body: xml
  });

  const raw = await response.text();

  if (!raw.includes("<Ack>Success</Ack>")) {
    return { success: false, error: raw };
  }

  return { success: true };
}
