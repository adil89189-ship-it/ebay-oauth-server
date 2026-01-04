import fetch from "node-fetch";

export async function forceInventoryQuantity(sku, quantity) {
  const url = `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`;

  const body = {
    availability: {
      shipToLocationAvailability: {
        quantity: quantity
      }
    }
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error("Inventory refresh failed: " + t);
  }
}
