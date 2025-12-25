import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN;
const EBAY_BASE = "https://api.ebay.com";

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
   DEBUG ENV (SAFE)
================================ */
app.get("/debug-env", (req, res) => {
  res.json({
    hasUserToken: !!process.env.EBAY_USER_TOKEN,
    hasAppId: !!process.env.EBAY_APP_ID,
    hasDevId: !!process.env.EBAY_DEV_ID,
    hasCertId: !!process.env.EBAY_CERT_ID
  });
});

/* ===============================
   VERIFY EBAY TOKEN (CORRECT)
   Handles 204 No Content
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  if (!EBAY_USER_TOKEN) {
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
          Authorization: `Bearer ${EBAY_USER_TOKEN}`
        }
      }
    );

    // ✅ SUCCESS: eBay returns 204 with EMPTY body
    if (response.status === 204) {
      return res.json({
        ok: true,
        message: "OAuth token is VALID (204 No Content)"
      });
    }

    // ❌ Any other response
    const text = await response.text();

    return res.status(response.status).json({
      ok: false,
      ebayStatus: response.status,
      ebayResponse: text || "Empty response"
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   UPDATE EBAY INVENTORY
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, quantity } = req.body;

    if (!amazonSku || !amazonPrice || !quantity) {
      return res.status(400).json({
        ok: false,
        error: "Missing amazonSku, amazonPrice, or quantity"
      });
    }

    if (!EBAY_USER_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "Missing EBAY_USER_TOKEN"
      });
    }

    /* ===== UPDATE INVENTORY ===== */
    const inventoryRes = await fetch(
      `${EBAY_BASE}/sell/inventory/v1/inventory_item/${amazonSku}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${EBAY_USER_TOKEN}`,
          "Content-Type": "application/json",
          "Accept-Language": "en-GB"
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

    if (!inventoryRes.ok) {
      const text = await inventoryRes.text();
      return res.status(400).json({
        ok: false,
        stage: "inventory",
        ebayError: text
      });
    }

    return res.json({
      ok: true,
      message: "Inventory updated successfully",
      sku: amazonSku,
      price: amazonPrice,
      quantity
    });

  } catch (err) {
    return res.status(500).json({
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
