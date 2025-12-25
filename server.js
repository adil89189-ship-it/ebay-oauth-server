import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

/* 🔴 FILL THESE */
const CLIENT_ID = "YOUR_EBAY_CLIENT_ID";
const CLIENT_SECRET = "YOUR_EBAY_CLIENT_SECRET";
const RU_NAME = "warecollection-warecoll-develo-bukuznz";

/* 🔐 TEMP TOKEN STORAGE (ENOUGH FOR YOU) */
let accessToken = "";
let refreshToken = "";

/* ===============================
   1️⃣ OAuth TOKEN EXCHANGE (ONCE)
   =============================== */
app.post("/auth", async (req, res) => {
  const { code } = req.body;

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: RU_NAME
    })
  });

  const data = await r.json();
  accessToken = data.access_token;
  refreshToken = data.refresh_token;

  res.json({ success: true });
});

/* ===============================
   2️⃣ PRICE & QTY SYNC ONLY
   =============================== */
app.post("/sync", async (req, res) => {
  const { sku, price, quantity } = req.body;

  const r = await fetch(
    `https://api.ebay.com/sell/inventory/v1/inventory_item/${sku}`,
    {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        availability: {
          shipToLocationAvailability: {
            quantity
          }
        },
        price: {
          value: price,
          currency: "GBP"
        }
      })
    }
  );

  const result = await r.json();
  res.json(result);
});

/* =============================== */
app.listen(3000, () => console.log("🚀 Backend running"));
