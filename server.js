import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Variation Sync LIVE"));

/* ===============================
   SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  const { amazonSku, parentItemId, variationName, variationValue, price, quantity } = req.body;

  if (!amazonSku || !parentItemId || typeof price !== "number" || typeof quantity !== "number") {
    return res.json({ ok: false, error: "Invalid payload" });
  }

  console.log("🚀 SYNC:", amazonSku, parentItemId, variationName, variationValue, price, quantity);

  try {
    const result = await reviseListing({ parentItemId, variationName, variationValue, price, quantity });
    if (!result.success) throw new Error(result.error);

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
    res.json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🟢 Server running on ${PORT}`));
