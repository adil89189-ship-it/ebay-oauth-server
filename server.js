const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.status(200).send("Server is running");
});

/* ===============================
   TEST SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  console.log("Sync request received:", req.body);

  if (!itemId || price == null || quantity == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // No eBay call yet — just confirm backend works
  res.json({
    success: true,
    message: "Backend reachable",
    data: { itemId, price, quantity }
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
