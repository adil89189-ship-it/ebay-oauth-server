import fetch from "node-fetch";
import { loadToken, saveToken } from "./tokenStore.js";

const EBAY_API = "https://api.ebay.com";

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

export async function updateInventory({ sku, price, quantity }) {
  let token = loadToken();
  if (!token || !token.refresh_token)
    return { ok: false, success: false, message: "Not authenticated" };

  if (!token.access_token || Date.now() >= token.expires_at) {
    const newAccessToken = await refreshAccessToken(token.refresh_token);
    if (!newAccessToken)
      return { ok: false, success: false, message: "Token refresh failed" };

    token = loadToken();
  }

  const res = await fetch(
    `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        "Content-Language": "en-GB"
      },
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: { quantity }
        },
        price: {
          value: price,
          currency: "GBP"
        }
      })
    }
  );

  const data = await res.text();
  return { ok: true, success: true, response: data };
}
