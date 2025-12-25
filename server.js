const express = require("express");
const fetch = require("node-fetch");
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
   TEST ENDPOINT (NO EBAY YET)
================================ */
app.post("/sync", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  console.log("Received sync request:", req.body);

  if (!itemId || price == null || quantity == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  // TEMP: just acknowledge request
  res.json({
    success: true,
    message: "Sync endpoint reachable",
    received: { itemId, price, quantity }
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
