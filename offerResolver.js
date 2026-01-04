import fetch from "node-fetch";
import { getItem } from "./ebayTrading.js";

export async function resolveOfferIdForVariation(parentItemId, variationName, variationValue) {

  // 1. Get full item with variations
  const item = await getItem(parentItemId);

  const variations = item?.Variations?.Variation;
  if (!variations) throw new Error("No variations found on listing");

  // 2. Find matching variation
  const match = variations.find(v => {
    const specifics = v.VariationSpecifics?.NameValueList || [];
    return specifics.some(
      s => s.Name === variationName && s.Value.includes(variationValue)
    );
  });

  if (!match) throw new Error("Matching variation not found");

  const ebayVariationSKU = match.SKU;
  if (!ebayVariationSKU) throw new Error("Variation has no eBay SKU");

  // 3. Find offer for that eBay SKU
  const res = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(ebayVariationSKU)}`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      }
    }
  );

  const data = await res.json();
  if (!data.offers || !data.offers.length) {
    throw new Error(`No offer found for variation SKU ${ebayVariationSKU}`);
  }

  return data.offers[0].offerId;
}
