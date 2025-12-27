import fetch from "node-fetch";
import { loadToken } from "./tokenStore.js";

export async function registerSku(sku) {
  const token = loadToken();

  if (!token || !token.access_token) {
    return { ok: false, message: "No access token" };
  }

  const res = await fetch(
    `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: { quantity: 1 }
        }
      })
    }
  );

  const text = await res.text();
  return { ok: true, response: text };
}
