import fetch from "node-fetch";

export async function forceInventoryQuantity(sku, quantity) {
  const url = `https://api.ebay.com/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`;

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

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ Inventory refresh failed:", text);
    throw new Error("Inventory refresh failed");
  }

  console.log("🧱 Inventory cache refreshed for", sku, "→", quantity);
}
