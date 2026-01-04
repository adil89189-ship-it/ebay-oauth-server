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

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text);
  }
}

export async function forceInventoryQuantity(sku, quantity) {
  const url = `https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;

  await apiPut(url, {
    availability: {
      shipToLocationAvailability: {
        quantity
      }
    }
  });

  console.log(`🧱 Inventory refreshed: ${sku} → ${quantity}`);
}

export async function unlockAndSetQuantity(sku, quantity) {
  console.log(`🧯 Unlocking SKU: ${sku}`);

  // Hard reset
  await forceInventoryQuantity(sku, 0);

  // Let eBay reconcile internal state
  await new Promise(res => setTimeout(res, 600));

  // Apply real quantity
  await forceInventoryQuantity(sku, quantity);
}
