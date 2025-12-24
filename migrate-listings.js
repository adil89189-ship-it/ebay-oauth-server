import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const EBAY_API = "https://api.ebay.com";
const headers = {
  Authorization: `Bearer ${process.env.EBAY_ACCESS_TOKEN}`,
  "Content-Type": "application/json"
};

/* =========================
   CONFIG — CHANGE THESE
========================= */
const POLICIES = {
  fulfillmentPolicyId: "FULFILLMENT_POLICY_ID",
  paymentPolicyId: "PAYMENT_POLICY_ID",
  returnPolicyId: "RETURN_POLICY_ID",
  locationKey: "WAREHOUSE"
};

/* =========================
   MIGRATE ONE SKU
========================= */
async function migrateSku(sku) {
  console.log("🔄 Migrating SKU:", sku);

  // 1️⃣ Create Inventory Item
  await axios.put(
    `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
    {
      availability: {
        shipToLocationAvailability: { quantity: 10 }
      },
      condition: "NEW"
    },
    { headers }
  );

  console.log("✅ Inventory item created");

  // 2️⃣ Create Offer
  const offerRes = await axios.post(
    `${EBAY_API}/sell/inventory/v1/offer`,
    {
      sku,
      marketplaceId: "EBAY_GB",
      format: "FIXED_PRICE",
      availableQuantity: 10,
      pricingSummary: {
        price: { value: "9.99", currency: "GBP" }
      },
      listingPolicies: POLICIES
    },
    { headers }
  );

  const offerId = offerRes.data.offerId;
  console.log("✅ Offer created:", offerId);

  // 3️⃣ Publish Offer
  await axios.post(
    `${EBAY_API}/sell/inventory/v1/offer/${offerId}/publish`,
    {},
    { headers }
  );

  console.log("🎉 SKU migrated successfully:", sku);
}

/* =========================
   RUN MIGRATION
========================= */
const sku = process.argv[2];
if (!sku) {
  console.error("❌ Usage: node migrate-listings.js AMAZON_SKU");
  process.exit(1);
}

migrateSku(sku).catch(err =>
  console.error("❌ Migration failed:", err.response?.data || err.message)
);
