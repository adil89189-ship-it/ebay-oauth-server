import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   DEBUG TOKEN (SAFE VERSION)
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const {
      EBAY_CLIENT_ID,
      EBAY_CLIENT_SECRET,
      EBAY_REFRESH_TOKEN,
      EBAY_OAUTH_URL
    } = process.env;

    if (!EBAY_OAUTH_URL) {
      return res.json({ ok: false, error: "EBAY_OAUTH_URL missing" });
    }

    const auth = Buffer.from(
      `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(`${EBAY_OAUTH_URL}/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    });

    const text = await response.text(); // 👈 SAFE READ

    if (!text) {
      return res.json({
        ok: false,
        error: "Empty response from eBay",
        status: response.status
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.json({
        ok: false,
        error: "Non-JSON response from eBay",
        raw: text
      });
    }

    if (!response.ok) {
      return res.json({
        ok: false,
        ebay: data
      });
    }

    return res.json({
      ok: true,
      access_token: data.access_token,
      expires_in: data.expires_in
    });

  } catch (err) {
    return res.json({
      ok: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
