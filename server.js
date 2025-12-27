import express from "express";
import cors from "cors";
import { updateInventory } from "./ebayInventory.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server LIVE");
});

/* ===============================
   LIVE SYNC ENGINE
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { sku, price, quantity } = req.body;

    if (!sku || typeof price !== "number" || typeof quantity !== "number") {
      return res.json({ ok: false, error: "Invalid payload" });
    }

    const result = await updateInventory({ sku, price, quantity });
    return res.json(result);

  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on ${PORT}`);
});
