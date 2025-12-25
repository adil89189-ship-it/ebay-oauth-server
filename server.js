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
    message: "eBay Sync Server Running"
  });
});

/* ===============================
   DEBUG ENV
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
   VERIFY EBAY USER TOKEN
   (Trading API — CORRECT METHOD)
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  if (!EBAY_USER_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "EBAY_USER_TOKEN missing"
    });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_USER_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
</GeteBayOfficialTimeRequest>`;

  try {
    const response = await fetch(
      "https://api.ebay.com/ws/api.dll",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "X-EBAY-API-CALL-NAME": "GeteBayOfficialTime",
          "X-EBAY-API-SITEID": "0",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
        },
        body: xml
      }
    );

    const text = await response.text();

    res.set("Content-Type", "text/xml");
    return res.send(text);

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
        error: "EBAY_USER_TOKEN missing"
      });
    }

    /* ===== UPDATE INVENTORY ITEM ===== */
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
