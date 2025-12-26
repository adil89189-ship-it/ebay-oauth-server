import express from "express";
import cors from "cors";

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
   SYNC ENDPOINT (HONEST)
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { sku, data } = req.body;

    // 🔒 BASIC VALIDATION
    if (!sku) {
      return res.status(400).json({
        ok: false,
        error: "Missing SKU"
      });
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        ok: false,
        error: "Missing SKU data"
      });
    }

    const { quantity, multiplier } = data;

    if (typeof quantity !== "number" || typeof multiplier !== "number") {
      return res.status(400).json({
        ok: false,
        error: "Invalid quantity or multiplier"
      });
    }

    /* ===============================
       FUTURE EBAY LOGIC GOES HERE
       - Price calculation
       - Inventory update
       - API response check
    ================================ */

    // ❗ TEMPORARY BEHAVIOUR (IMPORTANT)
    // Until eBay API is implemented, we FAIL ON PURPOSE
    return res.status(501).json({
      ok: false,
      error: "eBay sync not implemented yet"
    });

  } catch (err) {
    console.error("SYNC ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Internal server error"
    });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
