import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV VALIDATION
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_REFRESH_TOKEN,
  EBAY_OAUTH_URL,
  EBAY_INVENTORY_URL
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_REFRESH_TOKEN) {
  console.error("❌ Missing required eBay environment variables");
}

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay OAuth & Inventory Server Running" });
});

/* ===============================
   REFRESH ACCESS TOKEN
================================ */
async function getAccessToken() {
  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${EBAY_OAUTH_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: EBAY_REFRESH_TOKEN,
      scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

/* ===============================
   DEBUG TOKEN TEST
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({
      ok: true,
      message: "Access token generated successfully",
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
   INVENTORY UPDATE (TEST)
================================ */
app.post("/sync/test", async (req, res) => {
  const { sku, price, quantity } = req.body;

  if (!sku || price === undefined || quantity === undefined) {
    return res.status(400).json({
      ok: false,
      error: "sku, price and quantity are required"
    });
  }

  try {
    const accessToken = await getAccessToken();

    const inventoryPayload = {
      availability: {
        shipToLocationAvailability: {
          quantity: Number(quantity)
        }
      },
      product: {
        title: "Test Product",
        description: "Inventory sync test item"
      }
    };

    const response = await fetch(
      `${EBAY_INVENTORY_URL}/inventory_item/${sku}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Language": "en-GB"
        },
        body: JSON.stringify(inventoryPayload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        ok: false,
        error: "Inventory update failed",
        ebay: data
      });
    }

    res.json({
      ok: true,
      message: "Inventory updated successfully",
      sku,
      quantity
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
