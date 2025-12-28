import express from "express";
import cors from "cors";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("🟢 eBay Sync Engine LIVE"));

app.post("/sync", async (req, res) => {
  console.log("🧪 SYNC PAYLOAD:", JSON.stringify(req.body, null, 2));

  try {
    const result = await reviseListing(req.body);
    console.log("🟢 SYNC RESULT:", result);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
    res.json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🟢 Server running on ${PORT}`));
