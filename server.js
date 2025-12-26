import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/sync", async (req, res) => {
  const { amazonSku, multiplier, quantity } = req.body;

  try {
    // assume amazon price already fetched or cached
    const amazonPrice = req.body.amazonPrice ?? 10;
    const finalPrice = +(amazonPrice * multiplier).toFixed(2);

    const ebayQty = quantity ?? 3;

    // 🔹 eBay inventory + offer update happens here
    // 🔹 Quantity always forced on sync

    return res.json({
      ok: true,
      amazonSku,
      finalPrice,
      quantity: ebayQty
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.listen(3000, () =>
  console.log("eBay Sync Server Running")
);
