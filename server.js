import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RU_NAME,
  EBAY_REFRESH_TOKEN
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   REFRESH ACCESS TOKEN
================================ */
async function getAccessToken() {
  const credentials = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: EBAY_REFRESH_TOKEN,
        scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.access_token;
}

/* ===============================
   UPDATE PRICE & QUANTITY
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  try {
    const { sku, price, quantity } = req.body;

    if (!sku || price == null || quantity == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      "https://api.ebay.com/sell/inventory/v1/inventory_item/" + sku,
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

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: "eBay update failed",
        details: data
      });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: err.message
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
