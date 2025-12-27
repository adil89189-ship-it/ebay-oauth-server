import fetch from "node-fetch";
import { loadToken } from "./tokenStore.js";

export async function reviseListing({ itemId, price, quantity }) {
  const token = loadToken();

  if (!token || !token.access_token) {
    return { ok: false, error: "Missing OAuth token on server" };
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
  <ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
    <RequesterCredentials>
      <eBayAuthToken>${token.access_token}</eBayAuthToken>
    </RequesterCredentials>
    <Item>
      <ItemID>${itemId}</ItemID>
      <StartPrice>${price}</StartPrice>
      <Quantity>${quantity}</Quantity>
    </Item>
  </ReviseFixedPriceItemRequest>`;

  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
    },
    body: xml
  });

  const raw = await res.text();

  // Return FULL eBay reply for debugging
  return { ok: true, ebayRawResponse: raw };
}
