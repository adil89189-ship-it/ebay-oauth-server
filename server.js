import express from "express";
import cors from "cors";
import { reviseListing, getCurrentVariationPrice } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🟢 eBay Trading Sync Engine LIVE (PROTECTED)");
});

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isAnomalous(newPrice, oldPrice) {
  if (!oldPrice) return false;
  const drop = (oldPrice - newPrice) / oldPrice;
  return drop > 0.2;
}

app.post("/sync", async (req, res) => {
  console.log("🔥 SYNC HIT", new Date().toISOString());
  console.log("BODY:", JSON.stringify(req.body, null, 2));

  try {
    const p = req.body;

    const buy = safeNumber(p.buy || p.lastBuy || p.price);
    const multiplier = safeNumber(p.multiplier);
    const oldSell = safeNumber(p.lastPrice);

    // 🔴 HARD OOS PRIORITY (STATUS FLAG)
    if (p.status === "OOS") {
      await reviseListing({
        parentItemId: p.parentItemId || p.ebayParentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        amazonSku: p.amazonSku,
        quantity: 0,
        price: null
      });

      console.log("🟡 OOS FORCED BY STATUS FLAG");
      return res.json({ ok: true, status: "OOS" });
    }

    // 🔴 HARD OOS PRIORITY (QUANTITY)
    if (Number(p.quantity) <= 0) {
      await reviseListing({
        parentItemId: p.parentItemId || p.ebayParentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        amazonSku: p.amazonSku,
        quantity: 0,
        price: null
      });

      console.log("🟡 OOS FORCED BY QUANTITY");
      return res.json({ ok: true, status: "OOS" });
    }

    // 🔒 VALIDATION
    if (!buy || !multiplier) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_BUY_OR_MULTIPLIER"
      });
    }

    let newSell = round2(buy * multiplier);

    if (newSell <= buy) {
      return res.status(400).json({
        ok: false,
        error: "SELL_BELOW_BUY_BLOCKED",
        buy,
        newSell
      });
    }

    if (isAnomalous(newSell, oldSell)) {
      return res.status(400).json({
        ok: false,
        error: "ANOMALY_BLOCKED",
        oldSell,
        newSell
      });
    }

    // 🧯 FALLBACK TO EBAY PRICE IF NEEDED
    if (!newSell || !Number.isFinite(newSell)) {
      console.warn("⚠️ FALLBACK TO EBAY PRICE");

      const ebayPrice = await getCurrentVariationPrice(
        p.parentItemId || p.ebayParentItemId,
        p.variationName,
        p.variationValue
      );

      if (!ebayPrice) {
        return res.status(400).json({
          ok: false,
          error: "NO_PRICE_AVAILABLE"
        });
      }

      newSell = ebayPrice;
    }

    // 🟢 APPLY PRICE + QTY
    await reviseListing({
      parentItemId: p.parentItemId || p.ebayParentItemId,
      variationName: p.variationName,
      variationValue: p.variationValue,
      amazonSku: p.amazonSku,
      quantity: Number(p.quantity),
      price: newSell
    });

    console.log("🟢 SAFE SYNC OK", {
      amazonSku: p.amazonSku,
      buy,
      sell: newSell
    });

    res.json({ ok: true, sell: newSell });

  } catch (err) {
    console.error("❌ SYNC ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on 3000 (PROTECTED MODE)");
});
