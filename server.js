import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();

/* ===============================
   CORS (Allow Chrome Extension)
================================ */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.options("*", cors());

app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Trading Sync LIVE");
});

/* ===============================
   MAIN SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { itemId, sku, price, quantity } = req.body;
    const finalItemId = itemId || sku;

    if (!finalItemId || typeof price !== "number" || typeof quantity !== "number") {
      return res.json({ ok: false, error: "Invalid payload" });
    }

    const safePrice = Math.max(Number(price.toFixed(2)), 0.99);

    const result = await reviseListing({
      itemId: finalItemId,
      price: safePrice,
      quantity
    });

    return res.json(result);
  } catch (err) {
    console.error("SYNC ERROR:", err);
    return res.json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on ${PORT}`);
});
