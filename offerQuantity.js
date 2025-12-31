import fetch from "node-fetch";
import { ensureAccessToken } from "./ebayOffer.js";

export async function updateOfferQuantity(offerId, quantity) {
  const token = await ensureAccessToken();

  const res = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      },
      body: JSON.stringify({ availableQuantity: quantity })
    }
  );

  const text = await res.text();
  return text;
}
