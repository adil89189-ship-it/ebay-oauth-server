import fetch from "node-fetch";

/* ===============================
   EBAY INVENTORY API
================================ */
async function inventoryRequest(method, path, body) {
  const res = await fetch(`https://api.ebay.com/sell/inventory/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${process.env.EBAY_INVENTORY_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return res.json();
}

/* ===============================
   SANITIZER (matches trading.js)
================================ */
function safeQty(q) {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/* ===============================
   PUBLIC ENTRY
================================ */
export async function updateOfferQuantity(offerId, quantity) {

  const safeQ = safeQty(quantity);

  // 🔍 Diagnostic log
  console.log("🧪 INVENTORY SANITIZED:", {
    offerId,
    rawQty: quantity,
    safeQty: safeQ
  });

  const body = {
    availableQuantity: safeQ
  };

  const result = await inventoryRequest(
    "POST",
    `/offer/${offerId}/publish`,
    body
  );

  if (!result || result.errors) {
    console.error("❌ INVENTORY SYNC ERROR:", result);
  } else {
    console.log("🟢 INVENTORY SYNC OK");
  }

  return result;
}
