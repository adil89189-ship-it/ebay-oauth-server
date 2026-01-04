import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";
try {
  await forceInventoryQuantity(data.amazonSku, data.quantity);
} catch {
}
const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Sync Engine LIVE"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const data = { ...req.body };
    const isVariation = data.variationName && data.variationValue;

    // 🧬 VARIATION LISTINGS — Trading API ONLY
    if (isVariation) {
      await reviseListing(data);
    }

    // 📦 SIMPLE LISTINGS — full pipeline
    else {
      await reviseListing(data);

      try {
        await forceInventoryQuantity(data.amazonSku, data.quantity);
      } catch {
        await unlockAndSetQuantity(data.amazonSku, data.quantity);
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
