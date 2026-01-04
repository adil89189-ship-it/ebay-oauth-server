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

    const isVariation = data.variationName && data.variationValue;

    // 🛡 Parent revise ONLY for simple listings
    if (!isVariation) {
      await reviseListing(data);
    }

    // 🛡 Inventory API ONLY for simple listings
    if (!isVariation) {
      try {
        await forceInventoryQuantity(data.amazonSku, data.quantity);
      } catch {
        await unlockAndSetQuantity(data.amazonSku, data.quantity);
      }
    }

    // 🧬 Variation handling
    if (isVariation) {
  // Variations are Trading-API only. Never touch offers.
  await reviseVariation(
    data.parentItemId,
    data.amazonSku,
    data.quantity,
    data.price
  );
}

    // 🧾 Offer quantity ONLY for simple listings
    if (data.offerId && !isVariation) {
      await updateOfferQuantity(data.offerId, data.quantity);
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
