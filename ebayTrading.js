import fetch from "node-fetch";

export async function reviseListing({ itemId, price, quantity }) {
  const userToken = process.env.EBAY_TRADING_TOKEN;

  if (!userToken) {
    return { ok: false, error: "EBAY_TRADING_TOKEN missing on server" };
  }

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
  return { ok: true, ebayResponse: raw };
}
