// server.js — STRICT SEQUENTIAL SYNC (GLOBAL QUEUE)

import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   GLOBAL SYNC QUEUE
========================= */

let syncQueue = Promise.resolve();

/* =========================
   HELPERS
========================= */

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

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) =>
  res.send("🟢 eBay Trading Sync Engine LIVE (SEQUENTIAL MODE)")
);

/**
 * 🔒 SEQUENTIAL SYNC ROUTE
 * - Requests are queued
 * - Never overlap
 * - Order preserved
 */
app.post("/sync", (req, res) => {
  syncQueue = syncQueue.then(async () => {
    try {
      console.log("🔁 SYNC START", new Date().toISOString());

      const p = req.body;

      const buy = safeNumber(p.buy);
      const multiplier = safeNumber(p.multiplier);
      const oldSell = safeNumber(p.lastPrice);

      /* ---- FORCE OOS ---- */
      /* ---- FORCE OOS ---- */
if (p.status === "OOS" || Number(p.quantity) <= 0) {
  try {
    await reviseListing({
      parentItemId: p.parentItemId || p.ebayParentItemId,
      variationName: p.variationName,
      variationValue: p.variationValue,
      amazonSku: p.amazonSku,
      quantity: 0,
      price: null
    });

    console.log("🟠 OOS applied successfully");
  } catch (err) {
    console.warn("⚠️ OOS revise warning:", err.message);
    // DO NOT convert OOS to FAIL
  }

  res.json({ ok: true, status: "OOS" });
  return;
}


      if (!buy || !multiplier) {
        res.status(400).json({ ok: false, error: "INVALID_BUY_OR_MULTIPLIER" });
        return;
      }

      const newSell = round2(buy * multiplier);

      if (newSell <= buy) {
        res.status(400).json({ ok: false, error: "SELL_BELOW_BUY_BLOCKED" });
        return;
      }

      if (isAnomalous(newSell, oldSell)) {
        res.status(400).json({ ok: false, error: "ANOMALY_BLOCKED" });
        return;
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
});

/* =========================
   START
========================= */

app.listen(3000, () => {
  console.log("🚀 Server running on 3000 (GLOBAL SYNC QUEUE ACTIVE)");
});
