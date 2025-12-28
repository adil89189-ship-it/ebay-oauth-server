import express from "express";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const REGISTRY_FILE = "./registry.json";

/* ===============================
   UTILITIES
================================ */
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) fs.writeFileSync(REGISTRY_FILE, "{}");
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
}

function saveRegistry(data) {
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2));
}

/* ===============================
   HEALTH
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server Running — Phase 1.2");
});

/* ===============================
   REGISTRY SAVE
================================ */
app.post("/registry/save", (req, res) => {
  const { amazonSku, ebayItemId, multiplier, defaultQty } = req.body;

  if (!amazonSku || !ebayItemId) {
    return res.json({ ok: false, error: "Missing SKU or Item ID" });
  }

  const registry = loadRegistry();

  registry[amazonSku] = {
    amazonSku,
    ebayItemId,
    multiplier,
    defaultQty,
    updatedAt: Date.now()
  };

  saveRegistry(registry);
  console.log("🧾 Registry Updated:", amazonSku);
  res.json({ ok: true });
});

/* ===============================
   REGISTRY LOAD
================================ */
app.get("/registry/load", (req, res) => {
  const registry = loadRegistry();
  res.json({ ok: true, registry });
});

/* ===============================
   CENTRAL SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  if (!itemId || typeof price !== "number" || typeof quantity !== "number") {
    return res.json({ ok: false, error: "Invalid sync payload" });
  }

  console.log("🚀 SYNC REQUEST:", { itemId, price, quantity });

  // 🔧 Your existing eBay Trading API update logic stays here
  // You already confirmed this logic works in your stable baseline

  // Simulated success response for now:
  res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on ${PORT}`);
});
