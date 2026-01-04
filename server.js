import express from "express";
import cors from "cors";
import { reviseListing, reviseVariation } from "./ebayTrading.js";
import { updateOfferQuantity } from "./offerQuantity.js";
import { forceInventoryQuantity, unlockAndSetQuantity } from "./inventoryRefresh.js";
import { resolveOfferIdForVariation } from "./offerResolver.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Sync Engine LIVE"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const data = { ...req.body };

    // 🛑 FIX: REMOVE DESTRUCTIVE OOS RULE
    // Old rule deleted:
    // if (data.price === null || data.quantity === 0) {
    //   data.quantity = 0;
    // }

    // Always update parent listing first
    await reviseListing(data);

    // Try Inventory route for non-variation quantity
    if (!data.variationName || !data.variationValue) {
      try {
        await forceInventoryQuantity(data.amazonSku, data.quantity);
      } catch {
        await unlockAndSetQuantity(data.amazonSku, data.quantity);
      }
    }

    // Resolve offer if possible (for inventory-managed listings)
    try {
      if (!data.offerId && data.variationName && data.variationValue) {
        data.offerId = await resolveOfferIdForVariation(
          data.parentItemId,
          data.variationName,
          data.variationValue
        );

        console.log("🧩 Resolved offerId:", data.offerId);
      }

      if (data.offerId) {
        await updateOfferQuantity(data.offerId, data.quantity);
        console.log("📦 Offer quantity updated");
      }

    } catch {
      // Legacy fallback for non-inventory variation listings
      if (data.variationName && data.variationValue) {
        await reviseVariation(
          data.parentItemId,
          data.amazonSku,
          data.quantity,
          data.price,
          data.price
        );
      }
    }

    console.log("🟢 SYNC COMPLETE");
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
