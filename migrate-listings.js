import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const EBAY_API = "https://api.ebay.com";

/* =========================
   AUTH HEADER
========================= */
const headers = {
  Authorization: `Bearer ${process.env.EBAY_ACCESS_TOKEN}`,
  "Content-Type": "application/json"
};

/* =========================
   FINAL AMAZON POLICY SET
========================= */
const POLICIES = {
  fulfillmentPolicyId: "251103266013",
  paymentPolicyId: "234552183013",
  returnPolicyId: "236141348013",
  locationKey: "WAREHOUSE"
};

/* =========================
   MIGRATE ONE SKU
========================= */
async function migrateSku(sku) {
  console.log("🔄 Migrating Amazon SKU → eBay Inventory:", sku);

  /* 1️⃣ CREATE / UPDATE INVENTORY ITEM */
  await axios.put(
    `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
    {
      condition: "NEW",
      availability: {
        shipToLocationAvailability: {
          quantity: 10
        }
      }
    },
    { headers }
  );

  console.log("✅ Inventory item created");

  /* 2️⃣ CREATE OFFER */
  const offerRes = await axios.post(
    `${EBAY_API}/sell/inventory/v1/offer`,
    {
      sku,
      marketplaceId: "EBAY_GB",
      format: "FIXED_PRICE",
      availableQuantity: 10,
      pricingSummary: {
        price: {
          value: "9.99",
          currency: "GBP"
        }
      },
      listingPolicies: POLICIES
    },
    { headers }
  );

  const offerId = offerRes.data.offerId;
  console.log("✅ Offer created:", offerId);

  /* 3️⃣ PUBLISH OFFER */
  await axios.post(
    `${EBAY_API}/sell/inventory/v1/offer/${offerId}/publish`,
    {},
    { headers }
  );

  console.log("🎉 MIGRATION COMPLETE FOR SKU:", sku);
}

/* =========================
   RUN
========================= */
const sku = process.argv[2];

if (!sku) {
  console.error("❌ Usage: node migrate-listings.js AMAZON_SKU");
  process.exit(1);
}

migrateSku(sku).catch(err => {
  console.error(
    "❌ Migration failed:",
    err.response?.data || err.message
  );
});
