import express from "express";
import cors from "cors";
import { fetchAmazonData } from "./amazonFetch.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running ✅");
});

/* =========================
   AMAZON TEST ROUTE
========================= */
app.get("/amazon/test", async (req, res) => {
  try {
    const { asin } = req.query;

    if (!asin) {
      return res.status(400).json({ error: "ASIN is required" });
    }

    const data = await fetchAmazonData(asin);
    res.json({ ok: true, data });

  } catch (err) {
    console.error("Amazon fetch error:", err.message);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
