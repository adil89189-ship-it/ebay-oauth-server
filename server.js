import express from "express";
import cors from "cors";
import { buildAuthUrl, exchangeCodeForToken } from "./ebayAuth.js";
import { updateInventory } from "./ebayInventory.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("🟢 eBay Sync Backend Running");
});

/* ===============================
   STEP 1: START OAUTH
================================ */
app.get("/oauth/start", (_, res) => {
  const url = buildAuthUrl();
  res.json({ ok: true, url });
});

/* ===============================
   STEP 2: OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Missing code");

  const result = await exchangeCodeForToken(code);
  if (!result.ok) return res.status(500).json(result);

  res.send("✅ eBay connected. You can close this window.");
});

/* ===============================
   STEP 3: SYNC INVENTORY
================================ */
app.post("/sync", async (req, res) => {
  const result = await updateInventory(req.body);
  res.json(result);
});

app.listen(process.env.PORT || 3000, () =>
  console.log("🚀 Backend live")
);
