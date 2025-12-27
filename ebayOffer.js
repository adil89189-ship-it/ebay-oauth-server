import fetch from "node-fetch";
import { loadToken } from "./tokenStore.js";

const EBAY_API = "https://api.ebay.com";
const MARKETPLACE = "EBAY_GB";

async function ebayGet(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB"
    }
  });
  return await res.json();
}

async function getPolicies(token) {
  const payment = await ebayGet(`${EBAY_API}/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE}`, token);
  const fulfillment = await ebayGet(`${EBAY_API}/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE}`, token);
  const returns = await ebayGet(`${EBAY_API}/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE}`, token);

  return {
    paymentPolicyId: payment.paymentPolicies[0].paymentPolicyId,
    fulfillmentPolicyId: fulfillment.fulfillmentPolicies[0].fulfillmentPolicyId,
    returnPolicyId: returns.returnPolicies[0].returnPolicyId
  };
}

async function getLocationKey(token) {
  const data = await ebayGet(`${EBAY_API}/sell/inventory/v1/location`, token);
  return data.locations[0].merchantLocationKey;
}

async function getCategoryId(token) {
  const tree = await ebayGet(`${EBAY_API}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${MARKETPLACE}`, token);
  const cats = await ebayGet(`${EBAY_API}/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_category_suggestions?q=cleaner`, token);
  return cats.categorySuggestions[0].category.categoryId;
}

async function createOffer(sku, token) {
  const policies = await getPolicies(token);
  const locationKey = await getLocationKey(token);
  const categoryId = await getCategoryId(token);

  const res = await fetch(`${EBAY_API}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB"
    },
    body: JSON.stringify({
      sku,
      marketplaceId: MARKETPLACE,
      format: "FIXED_PRICE",
      categoryId,
      merchantLocationKey: locationKey,
      listingPolicies: policies,
      availableQuantity: 1,
      listingDescription: "Managed by Sync Engine"
    })
  });

  const data = await res.json();
  return data.offerId;
}

async function publishOffer(offerId, token) {
  const res = await fetch(`${EBAY_API}/sell/inventory/v1/offer/${offerId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}` }
  });

  return await res.text();
}

export async function bindOffer(sku) {
  const token = loadToken();
  if (!token?.access_token) return { ok: false, message: "Not authenticated" };

  const offerId = await createOffer(sku, token);
  const result = await publishOffer(offerId, token);

  return { ok: true, offerId, result };
}
