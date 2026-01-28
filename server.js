import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) =>
  res.send("🟢 eBay Trading Sync Engine LIVE (PROTECTED)")
);

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

    // 🔴 FORCE OOS FIRST
    if (p.status === "OOS" || Number(p.quantity) <= 0) {
      await reviseListing({
        parentItemId: p.parentItemId || p.ebayParentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        amazonSku: p.amazonSku,
        quantity: 0,
        price: null
      });

      return res.json({ ok: true, status: "OOS" });
    }

    if (!buy || !multiplier) {
      return res.status(400).json({ ok: false, error: "INVALID_BUY_OR_MULTIPLIER" });
    }

    let newSell = round2(buy * multiplier);

    if (newSell <= buy) {
      return res.status(400).json({ ok: false, error: "SELL_BELOW_BUY_BLOCKED" });
    }

    if (isAnomalous(newSell, oldSell)) {
      return res.status(400).json({ ok: false, error: "ANOMALY_BLOCKED" });
    }

    await reviseListing({
      parentItemId: p.parentItemId || p.ebayParentItemId,
      variationName: p.variationName,
      variationValue: p.variationValue,
      amazonSku: p.amazonSku,
      quantity: Number(p.quantity),
      price: newSell
    });

    res.json({ ok: true, sell: newSell });

  } catch (err) {
    console.error("❌ SYNC ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () =>
  console.log("🚀 Server running on 3000 (PROTECTED MODE)")
);
