import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { getEbayAccessToken } from "./tokenHelper.js";

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
   FINAL /SYNC ROUTE (PRODUCTION)
   Chrome → Server → eBay
================================ */
app.post("/sync", async (req, res) => {
  try {
    const {
      amazonSku,
      amazonPrice,
      defaultQuantity,
      availability
    } = req.body;

    // 🔒 Hard validation (extension-safe)
    if (!amazonSku || !amazonPrice || defaultQuantity === undefined) {
      return res.status(400).json({
        ok: false,
        message: "Missing required fields"
      });
    }

    // 🧠 YOUR QUANTITY RULE (LOCKED)
    const finalQuantity =
      availability === "out_of_stock" ? 0 : Number(defaultQuantity);

    // 💷 Price (already multiplied by extension)
    const finalPrice = Number(Number(amazonPrice).toFixed(2));

    // 🔑 Get cached access token
    const accessToken = await getEbayAccessToken();

    // 🌍 eBay Inventory API
    const ebayUrl = `https://api.ebay.com/sell/inventory/v1/inventory_item/${amazonSku}`;

    const ebayPayload = {
      availability: {
        shipToLocationAvailability: {
          quantity: finalQuantity
        }
      },
      price: {
        value: finalPrice,
        currency: "GBP"
      }
    };

    const ebayResponse = await fetch(ebayUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Language": "en-GB",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(ebayPayload)
    });

    const raw = await ebayResponse.text();

    // 🧠 eBay may return empty body on error — handle safely
    let parsed = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }

    if (!ebayResponse.ok) {
      return res.status(ebayResponse.status).json({
        ok: false,
        status: ebayResponse.status,
        ebayResponse: parsed || "Empty response from eBay"
      });
    }

    // ✅ SUCCESS
    res.json({
      ok: true,
      sku: amazonSku,
      price: finalPrice,
      quantity: finalQuantity,
      ebayStatus: ebayResponse.status
    });
  } catch (err) {
    console.error("❌ SYNC ERROR:", err.message);
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
