import fetch from "node-fetch";
import { loadToken, saveToken } from "./tokenStore.js";

const EBAY_API = "https://api.ebay.com";
const MARKETPLACE = "EBAY_GB";

async function refreshAccessToken(refreshToken) {
  const creds = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await res.json();
  if (!data.access_token) return null;

  data.expires_at = Date.now() + data.expires_in * 1000;
  saveToken({ ...loadToken(), ...data });

  return data.access_token;
}

async function ensureAccessToken() {
  let token = loadToken();
  if (!token || !token.refresh_token) return null;

  if (!token.access_token || Date.now() >= token.expires_at) {
    const newToken = await refreshAccessToken(token.refresh_token);
    if (!newToken) return null;
    token = loadToken();
  }

  return token.access_token;
}

/* ------------------ EBAY HELPERS ------------------ */

async function ebayGet(url, accessToken) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Content-Language": "en-GB"
    }
  });
  return await res.json();
}

async function getPolicies(accessToken) {
  const payment = await ebayGet(`${EBAY_API}/sell/account/v1/payment_policy?marketplace_id=${MARKETPLACE}`, accessToken);
  const fulfillment = await ebayGet(`${EBAY_API}/sell/account/v1/fulfillment_policy?marketplace_id=${MARKETPLACE}`, accessToken);
  const returns = await ebayGet(`${EBAY_API}/sell/account/v1/return_policy?marketplace_id=${MARKETPLACE}`, accessToken);

  return {
    paymentPolicyId: payment.paymentPolicies[0].paymentPolicyId,
    fulfillmentPolicyId: fulfillment.fulfillmentPolicies[0].fulfillmentPolicyId,
    returnPolicyId: returns.returnPolicies[0].returnPolicyId
  };
}

async function getLocationKey(accessToken) {
  const data = await ebayGet(`${EBAY_API}/sell/inventory/v1/location`, accessToken);
  return data.locations[0].merchantLocationKey;
}

async function getCategoryId(accessToken) {
  const tree = await ebayGet(`${EBAY_API}/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${MARKETPLACE}`, accessToken);
  const cats = await ebayGet(`${EBAY_API}/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_category_suggestions?q=cleaner`, accessToken);
  return cats.categorySuggestions[0].category.categoryId;
}

async function createOffer(sku, accessToken) {
  const policies = await getPolicies(accessToken);
  const locationKey = await getLocationKey(accessToken);
  const categoryId = await getCategoryId(accessToken);

  const res = await fetch(`${EBAY_API}/sell/inventory/v1/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

async function publishOffer(offerId, accessToken) {
  const res = await fetch(`${EBAY_API}/sell/inventory/v1/offer/${offerId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return await res.text();
}

export async function bindOffer(sku) {
  const accessToken = await ensureAccessToken();
  if (!accessToken) return { ok: false, message: "Not authenticated" };

  const offerId = await createOffer(sku, accessToken);
  const result = await publishOffer(offerId, accessToken);

  return { ok: true, offerId, result };
}
