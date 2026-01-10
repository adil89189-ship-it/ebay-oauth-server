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

    // 🧱 HARD OOS ENFORCEMENT (Fresh / Morrisons & any forced OOS case)
    if (Number(p.quantity) === 0) {
      await reviseListing({
        parentItemId: p.parentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        sku: p.sku,
        quantity: 0,
        price: 0.99   // eBay requires valid price even when OOS
      });
    } 
    else {
      await reviseListing({
        parentItemId: p.parentItemId,
        variationName: p.variationName,
        variationValue: p.variationValue,
        sku: p.sku,
        quantity: p.quantity,
        price: p.price
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
