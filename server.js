import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { reviseListing } from "./ebayTrading.js";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGISTRY_FILE = path.join(__dirname, "registry.json");
const LOG_FILE = path.join(__dirname, "sync-log.json");

/* ===============================
   FILE UTILITIES
================================ */
function loadFile(file, fallback = {}) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ===============================
   HEALTH
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay Sync Server Running — PRODUCTION ACTIVE");
});

/* ===============================
   REGISTRY SAVE
================================ */
app.post("/registry/save", (req, res) => {
  const { amazonSku, ebayItemId, multiplier, defaultQty } = req.body;
  if (!amazonSku || !ebayItemId) return res.json({ ok: false, error: "Missing SKU or Item ID" });

  const registry = loadFile(REGISTRY_FILE);

  registry[amazonSku] = {
    amazonSku,
    ebayItemId,
    multiplier,
    defaultQty,
    updatedAt: Date.now()
  };

  saveFile(REGISTRY_FILE, registry);
  res.json({ ok: true });
});

/* ===============================
   REGISTRY LOAD
================================ */
app.get("/registry/load", (req, res) => {
  const registry = loadFile(REGISTRY_FILE);
  res.json({ ok: true, registry });
});

/* ===============================
   PRODUCTION SYNC ENGINE
================================ */
app.post("/sync", async (req, res) => {
  const { amazonSku, itemId, price, quantity } = req.body;

  if (!amazonSku || !itemId || typeof price !== "number" || typeof quantity !== "number") {
    return res.json({ ok: false, error: "Invalid payload" });
  }

  console.log("🚀 SYNC:", amazonSku, itemId, price, quantity);

  const log = loadFile(LOG_FILE, {});
  const today = new Date().toISOString().slice(0, 10);

  try {
    const result = await reviseListing({ itemId, price, quantity });

    if (!result.success) throw new Error(result.error || "Unknown API error");

    log[amazonSku] = { status: "success", date: today, time: Date.now() };
    saveFile(LOG_FILE, log);

    return res.json({ ok: true });
  }
  catch (err) {
    console.error("❌ SYNC ERROR:", err.message);

    log[amazonSku] = { status: "fail", date: today, time: Date.now(), error: err.message };
    saveFile(LOG_FILE, log);

    return res.json({ ok: false, error: err.message });
  }
});

/* ===============================
   SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server live on ${PORT}`);
});
