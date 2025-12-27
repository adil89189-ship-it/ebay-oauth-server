import fetch from "node-fetch";
import { loadToken } from "./tokenStore.js";

const EBAY_API = "https://api.ebay.com";

/**
 * Find existing offer for this SKU (if already bound)
 */
async function findExistingOffer(sku, token) {
  const res = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      }
    }
  );

  const data = await res.json();
  if (data.offers && data.offers.length > 0) {
    return data.offers[0].offerId;
  }
  return null;
}

/**
 * Create offer only if it doesn't already exist
 */
async function createOfferIfMissing(sku, token) {
  const existingOffer = await findExistingOffer(sku, token);
  if (existingOffer) return existingOffer;

  const res = await fetch(`${EBAY_API}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB"
    },
    body: JSON.stringify({
      sku,
      marketplaceId: "EBAY_GB",
      format: "FIXED_PRICE",
      listingDescription: "Auto-managed by sync system",
      availableQuantity: 1
    })
  });

  const data = await res.json();
  return data.offerId;
}

/**
 * Publish the offer (binds it to live listing)
 */
async function publishOffer(offerId, token) {
  const res = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer/${offerId}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json"
      }
    }
  );

  return await res.text();
}

/**
 * Main binding function
 */
export async function bindOffer(sku) {
  const token = loadToken();
  if (!token || !token.access_token)
    return { ok: false, message: "Not authenticated" };

  const offerId = await createOfferIfMissing(sku, token);
  const result = await publishOffer(offerId, token);

  return { ok: true, offerId, result };
}
