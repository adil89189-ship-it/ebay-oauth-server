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
  EBAY_ENV
} = process.env;

const EBAY_API =
  EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running (Option A + Debug)");
});

/* ===============================
   GET ACCESS TOKEN
================================ */
async function getAccessToken() {
  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_API}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    }
  );

  const data = await response.json();

  if (!data.access_token) {
    console.error("❌ TOKEN REFRESH FAILED", data);
    throw new Error("Token refresh failed");
  }

  return data.access_token;
}

/* ===============================
   DEBUG INVENTORY ITEM
================================ */
app.get("/debug/inventory/:sku", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `${EBAY_API}/sell/inventory/v1/inventory_item/${req.params.sku}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const data = await response.json();

    res.json({
      sku: req.params.sku,
      httpStatus: response.status,
      data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   UPDATE INVENTORY QUANTITY
================================ */
async function updateInventoryQuantity(sku, quantity, accessToken) {
  const response = await fetch(
    `${EBAY_API}/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: {
            quantity
          }
        }
      })
    }
  );

  return {
    ok: response.ok,
    status: response.status,
    body: await response.json()
  };
}

/* ===============================
   GET OFFER ID
================================ */
async function getOfferId(sku, accessToken) {
  const response = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer?sku=${sku}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const data = await response.json();
  return data.offers?.[0]?.offerId || null;
}

/* ===============================
   UPDATE OFFER PRICE
================================ */
async function updateOfferPrice(offerId, price, accessToken) {
  const response = await fetch(
    `${EBAY_API}/sell/inventory/v1/offer/${offerId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        pricingSummary: {
          price: {
            value: price.toFixed(2),
            currency: "GBP"
          }
        }
      })
    }
  );

  return {
    ok: response.ok,
    status: response.status,
    body: await response.json()
  };
}

/* ===============================
   SYNC ENDPOINT
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, inStock } = req.body;

    if (!amazonSku || amazonPrice == null) {
      return res.status(400).json({
        ok: false,
        reason: "INVALID_PAYLOAD",
        received: req.body
      });
    }

    const DEFAULT_QTY = inStock ? 5 : 0;
    const PRICE_MULTIPLIER = 1.35;
    const finalPrice = amazonPrice * PRICE_MULTIPLIER;

    const accessToken = await getAccessToken();

    /* ---- Quantity Update ---- */
    const qtyResult = await updateInventoryQuantity(
      amazonSku,
      DEFAULT_QTY,
      accessToken
    );

    if (!qtyResult.ok) {
      console.error("❌ QTY UPDATE FAILED", amazonSku, qtyResult);
      return res.json({
        ok: false,
        sku: amazonSku,
        step: "quantity",
        error: qtyResult
      });
    }

    /* ---- Price Update ---- */
    const offerId = await getOfferId(amazonSku, accessToken);

    if (!offerId) {
      console.error("❌ OFFER NOT FOUND", amazonSku);
      return res.json({
        ok: false,
        sku: amazonSku,
        step: "price",
        reason: "OFFER_NOT_FOUND"
      });
    }

    const priceResult = await updateOfferPrice(
      offerId,
      finalPrice,
      accessToken
    );

    if (!priceResult.ok) {
      console.error("❌ PRICE UPDATE FAILED", amazonSku, priceResult);
      return res.json({
        ok: false,
        sku: amazonSku,
        step: "price",
        error: priceResult
      });
    }

    console.log("✅ SYNC SUCCESS", amazonSku);

    res.json({
      ok: true,
      sku: amazonSku,
      quantity: DEFAULT_QTY,
      price: finalPrice.toFixed(2)
    });

  } catch (err) {
    console.error("❌ SYNC ERROR", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
