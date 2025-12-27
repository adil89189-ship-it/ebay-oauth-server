import express from "express";
import cors from "cors";
import { updateInventory } from "./ebayInventory.js";
import { registerSku } from "./ebayRegister.js";
import { bindOffer } from "./ebayOffer.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("🟢 eBay Sync Backend Running");
});

/* ===============================
   REGISTER SKU (ONE-TIME)
================================ */
app.post("/register-sku", async (req, res) => {
  const { sku } = req.body;
  if (!sku) return res.json({ ok: false, message: "Missing SKU" });

  const result = await registerSku(sku);
  res.json(result);
});

/* ===============================
   BIND OFFER (ONE-TIME)
================================ */
app.post("/bind-offer", async (req, res) => {
  const { sku } = req.body;
  if (!sku) return res.json({ ok: false, message: "Missing SKU" });

  const result = await bindOffer(sku);
  res.json(result);
});

/* ===============================
   LIVE SYNC
================================ */
app.post("/sync", async (req, res) => {
  const result = await updateInventory(req.body);
  res.json(result);
});

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Backend live")
);
