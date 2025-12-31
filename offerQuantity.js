import fetch from "node-fetch";
import { getInventoryToken } from "./inventoryAuth.js";

export async function updateOfferQuantity(offerId, quantity) {
  const accessToken = await getInventoryToken();

  const res = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      },
      body: JSON.stringify({
        availableQuantity: quantity
      })
    }
  );

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ Offer quantity update failed:", text);
    throw new Error("Offer quantity update failed");
  }

  return text;
}
