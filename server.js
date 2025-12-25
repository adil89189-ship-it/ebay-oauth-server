import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const EBAY_ACCESS_TOKEN = process.env.EBAY_USER_TOKEN;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "eBay OAuth Server Running"
  });
});

/* ===============================
   OAUTH TOKEN VERIFICATION
   (CORRECT METHOD)
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  if (!EBAY_ACCESS_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "EBAY_USER_TOKEN missing"
    });
  }

  try {
    const response = await fetch(
      "https://api.ebay.com/identity/v1/user/",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${EBAY_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const text = await response.text();

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "Invalid JSON from eBay",
        raw: text
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        ebayError: json
      });
    }

    res.json({
      ok: true,
      message: "OAuth token is VALID",
      ebayUser: json
    });

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
