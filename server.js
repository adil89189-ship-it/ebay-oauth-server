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
  EBAY_REDIRECT_URI,
  EBAY_REFRESH_TOKEN,
  EBAY_ENV
} = process.env;

const EBAY_OAUTH_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

const EBAY_INVENTORY_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com/sell/inventory/v1"
    : "https://api.sandbox.ebay.com/sell/inventory/v1";

/* ===============================
   HELPER — GET ACCESS TOKEN
================================ */
async function getAccessToken() {
  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: EBAY_REFRESH_TOKEN,
    scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
  });

  const res = await fetch(EBAY_OAUTH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("Failed to obtain access token");
  }

  return data.access_token;
}

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth & Inventory Server Running");
});

/* ===============================
   DEBUG — TOKEN CHECK
================================ */
app.get("/debug/token", async (req, res) => {
  try {
    const token = await getAccessToken();
    res.json({ ok: true, token_valid: true });
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

    if (!sku || price === undefined || quantity === undefined) {
      return res.json({
        ok: false,
        error: "sku, price and quantity are required"
      });
    }

    const accessToken = await getAccessToken();

    const payload = {
      sku,
      availability: {
        shipToLocationAvailability: {
          quantity: Number(quantity)
        }
      },
      pricingSummary: {
        price: {
          value: Number(price),
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
          "Content-Type": "application/json",
          "Accept-Language": "en-GB" // ✅ VALID (NOT Content-Language)
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.json({
        ok: false,
        error: "Inventory update failed",
        ebay: data
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
