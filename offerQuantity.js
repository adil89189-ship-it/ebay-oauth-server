import fetch from "node-fetch";
import { getInventoryToken } from "./inventoryAuth.js";

/* ===============================
   GLOBAL QUANTITY LOCK
   Prevents concurrent stock races
================================ */
let quantityLock = Promise.resolve();

export async function updateOfferQuantity(offerId, quantity) {
  // Queue all quantity updates so eBay cannot race itself
  quantityLock = quantityLock.then(async () => {
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
        body: JSON.stringify({ availableQuantity: quantity })
      }
    );

    const text = await res.text();

    if (!res.ok) {
      console.error("❌ Offer quantity update failed:", text);
      throw new Error("Offer quantity update failed");
    }

    // Let eBay fully settle before the next quantity update
    await new Promise(r => setTimeout(r, 900));
  });

  return quantityLock;
}
