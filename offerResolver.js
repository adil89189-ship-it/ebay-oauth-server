import fetch from "node-fetch";

export async function resolveOfferIdForVariation(sku, variationName, variationValue) {
  const listRes = await fetch(
    `https://api.ebay.com/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      }
    }
  );

  const listData = await listRes.json();

  if (!listData.offers || !listData.offers.length) {
    throw new Error(`No offers found for SKU ${sku}`);
  }

  for (const offer of listData.offers) {
    const detailRes = await fetch(
      `https://api.ebay.com/sell/inventory/v1/offer/${offer.offerId}`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`,
          "Content-Type": "application/json",
          "Content-Language": "en-GB"
        }
      }
    );

    const detail = await detailRes.json();

    const text = JSON.stringify(detail);

    if (
      text.includes(`${variationName}: ${variationValue}`) ||
      text.includes(variationValue)
    ) {
      return offer.offerId;
    }
  }

  throw new Error(`Matching offer not found for ${variationName}=${variationValue}`);
}
