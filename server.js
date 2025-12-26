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
   PLACEHOLDER (Future Sync)
================================ */
app.post("/sync", (req, res) => {
  res.json({
    ok: true,
    message: "Sync endpoint placeholder – Step E uses local storage only"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
