import express from "express";
import cors from "cors";
import { fetchAmazonData } from "./amazonFetch.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * Health check
 */
app.get("/", (req, res) => {
  res.send("✅ Amazon → eBay Sync Server Running");
});

/**
 * Test Amazon fetch
 * Example:
 * /amazon/test?asin=B01CZNPFCC
 */
app.get("/amazon/test", async (req, res) => {
  try {
    const { asin } = req.query;

    if (!asin) {
      return res.status(400).json({ error: "ASIN is required" });
    }

    const data = await fetchAmazonData(asin);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
