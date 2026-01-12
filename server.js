import express from "express";
import cors from "cors";
import { reviseListing, getCurrentVariationPrice } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Trading Sync Engine LIVE"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const p = req.body;

    let safePrice = Number(p.lastPrice) || Number(p.sell) || Number(p.price);

    // 🧠 Only require price when item is IN STOCK
    if (Number(p.quantity) > 0) {
      if (!Number.isFinite(safePrice) || safePrice <= 0) {
        safePrice = await getCurrentVariationPrice(
          p.parentItemId,
          p.variationName,
          p.variationValue
        );
      }
    }

    await reviseListing({
      parentItemId: p.parentItemId || p.ebayParentItemId,
      variationName: p.variationName,
      variationValue: p.variationValue,
      sku: p.ebayVariationSku,
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

app.listen(3000, () => console.log("🚀 Server running on 3000"));
