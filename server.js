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

    // 🧠 BACKEND-DRIVEN STATE CONTROL
    if (p.amazonState === "FRESH") {
      await reviseListing({
        parentItemId: p.parentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        sku: p.sku,
        quantity: 0,
        price: 0.99
      });
    } 
    else {
      const finalPrice = Number((p.rawPrice * p.multiplier).toFixed(2));

      await reviseListing({
        parentItemId: p.parentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        sku: p.sku,
        quantity: p.desiredQty,
        price: finalPrice
      });
    }

    console.log("🟢 SYNC RESULT: OK");
    res.json({ ok: true });
  } 
  catch (err) {
    console.error("❌ SYNC ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Server running on 3000"));
