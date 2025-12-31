import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";
import { updateOfferQuantity } from "./offerQuantity.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Sync Engine LIVE"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const data = { ...req.body };

    if (data.price === null || data.quantity === 0) {
      data.quantity = 0;
    }

    // 1️⃣ Update listing price + structure
    await reviseListing(data);

    // 2️⃣ Lock quantity via Inventory Offer (this is the missing piece)
    if (data.offerId) {
      await updateOfferQuantity(data.offerId, data.quantity);
    }

    console.log("🟢 SYNC RESULT: OK");
    res.json({ ok: true, success: true });
  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
    res.json({ ok: false, success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🟢 Server running on ${PORT}`));
