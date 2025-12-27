import fetch from "node-fetch";
import { loadToken } from "./tokenStore.js";

export async function updateInventory({ sku, price, quantity }) {
  const token = loadToken();
  if (!token) return { ok: false, message: "Not authenticated" };

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
          shipToLocationAvailability: {
            quantity
          }
        },
        price: {
          value: price,
          currency: "GBP"
        }
      })
    }
  );

  const data = await res.text();
  return { ok: true, response: data };
}
