import express from "express";
import cors from "cors";
import { getEbayAccessToken } from "./tokenHelper.js";

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

/* ===============================
   DEBUG TOKEN CHECK
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const token = await getEbayAccessToken();
    res.json({
      ok: true,
      tokenPreview: token.slice(0, 25) + "..."
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   PLACEHOLDER SYNC (NEXT STEP)
================================ */
app.post("/sync", async (req, res) => {
  res.json({
    ok: true,
    message: "Sync endpoint placeholder – inventory logic next"
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
