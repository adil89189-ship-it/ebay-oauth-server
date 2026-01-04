import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Sync Engine STABLE"));

app.post("/sync", async (req, res) => {
  try {
    const data = { ...req.body };

    // Normalize payload (keeps extension compatibility)
    data.sku = data.sku || data.amazonSku;

    if (!data.parentItemId || !data.sku || data.price === undefined || data.quantity === undefined) {
      throw new Error("Invalid variation payload");
    }

    await reviseListing(data);

    console.log("🟢 SYNC OK:", data.sku, data.price, data.quantity);
    res.json({ ok: true });

  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Sync server running"));
