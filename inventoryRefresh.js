import fetch from "node-fetch";

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Content-Language": "en-GB",
      "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
}

export async function forceInventoryQuantity(sku, quantity) {
  await apiPut(`https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    availability: {
      shipToLocationAvailability: { quantity }
    }
  });
}

export async function unlockAndSetQuantity(sku, quantity) {
  await forceInventoryQuantity(sku, quantity);
}
