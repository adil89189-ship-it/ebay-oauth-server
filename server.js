import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Trading Sync Engine LIVE"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const p = req.body;

    // Always preserve last known price for variation OOS
 let safePrice = Number(p.lastPrice);

if (!Number.isFinite(safePrice) || safePrice <= 0) {
  safePrice = Number(p.sell);
}

if (!Number.isFinite(safePrice) || safePrice <= 0) {
  safePrice = Number(p.price);
}

if (!Number.isFinite(safePrice) || safePrice <= 0) {
  throw new Error("No valid price available for OOS update");
}
    if (Number(p.quantity) === 0) {
      console.log("🧊 Applying SAFE OOS update");
      await reviseListing({
        parentItemId: p.parentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        sku: p.sku,
        quantity: 0,
        price: safePrice
      });
    } else {
      await reviseListing({
        parentItemId: p.parentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        sku: p.sku,
        quantity: p.quantity,
        price: safePrice
      });
    }

    console.log("🟢 SYNC RESULT: OK");
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ SYNC ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Server running on 3000"));
