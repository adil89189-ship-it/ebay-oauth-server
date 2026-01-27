import express from "express";
import cors from "cors";
import { reviseListing, getCurrentVariationPrice } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Trading Sync Engine LIVE (SAFE MODE)"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const p = req.body;

    // 🔑 Always prefer freshly calculated price
    let freshPrice = Number(p.sell) || Number(p.price) || null;
    let oldPrice   = Number(p.lastPrice) || null;
    let safePrice  = null;

    // 🧠 If item is in stock, we must have a valid price
    if (Number(p.quantity) > 0) {

      // ❌ No fresh price? → fallback to eBay
      if (!freshPrice || !Number.isFinite(freshPrice) || freshPrice <= 0) {
        console.warn("⚠️ Fresh price missing, falling back to eBay price");
        safePrice = await getCurrentVariationPrice(
          p.parentItemId || p.ebayParentItemId,
          p.variationName,
          p.variationValue
        );
      } else {
        safePrice = freshPrice;
      }

      // 🧨 Anomaly protection: block huge drops
      if (oldPrice && safePrice && safePrice < oldPrice * 0.7) {
        console.error("🚨 PRICE DROP BLOCKED", {
          amazonSku: p.amazonSku,
          oldPrice,
          safePrice
        });

        return res.status(400).json({
          ok: false,
          error: "ANOMALY_BLOCKED",
          oldPrice,
          newPrice: safePrice
        });
      }

    } else {
      // Out of stock → allow quantity zero, no price change needed
      safePrice = oldPrice || null;
    }

    await reviseListing({
      parentItemId: p.parentItemId || p.ebayParentItemId,
      variationName: p.variationName,
      variationValue: p.variationValue,

      // Always use Amazon SKU for variation SKU
      amazonSku: p.amazonSku,

      quantity: Number(p.quantity),
      price: safePrice
    });

    console.log("🟢 SYNC RESULT: OK");
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ SYNC ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Server running on 3000 (SAFE MODE)"));
