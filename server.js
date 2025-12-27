import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN,
  EBAY_OAUTH_URL,
  EBAY_INVENTORY_URL,
  PORT = 10000
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running");
});

/* ===============================
   GET ACCESS TOKEN
================================ */
async function getAccessToken() {
  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_OAUTH_URL}/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: EBAY_REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("❌ Failed to get access token");
  }

  return data.access_token;
}

/* ===============================
   DEBUG TOKEN TEST
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, token_valid: !!token });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   INVENTORY TEST (REAL UPDATE)
================================ */
app.post("/sync/test", async (req, res) => {
  try {
    const { sku, price, quantity } = req.body;

    if (!sku || price == null || quantity == null) {
      return res.status(400).json({
        ok: false,
        message: "sku, price, quantity required"
      });
    }

    const accessToken = await getAccessToken();

    const payload = {
      availability: {
        shipToLocationAvailability: {
          quantity
        }
      },
      product: {},
      pricingSummary: {
        price: {
          value: price,
          currency: "GBP"
        }
      }
    };

    const response = await fetch(
      `${EBAY_INVENTORY_URL}/inventory_item/${encodeURIComponent(sku)}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        ebay_error: result
      });
    }

    res.json({
      ok: true,
      message: "Inventory update accepted",
      sku
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
