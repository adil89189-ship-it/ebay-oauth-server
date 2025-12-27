import express from "express";
import cors from "cors";
import { updateInventory } from "./ebayInventory.js";
import { registerSku } from "./ebayRegister.js";
import { createOffer, publishOffer } from "./ebayOffer.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("🟢 eBay Sync Backend Running");
});

app.post("/register-sku", async (req, res) => {
  const { sku } = req.body;
  const result = await registerSku(sku);
  res.json(result);
});

app.post("/bind-offer", async (req, res) => {
  const { sku } = req.body;
  const offerId = await createOffer(sku);
  const result = await publishOffer(offerId);
  res.json({ ok: true, offerId, result });
});

app.post("/sync", async (req, res) => {
  const result = await updateInventory(req.body);
  res.json(result);
});

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Backend live")
);
