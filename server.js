import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RU_NAME
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay OAuth Server Running");
});

/* ===============================
   SHARED OAUTH EXCHANGE LOGIC
================================ */
async function exchangeCode(code, res) {
  if (!code) {
    return res.status(400).json({ error: "Authorization code missing" });
  }

  try {
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
          grant_type: "authorization_code",
          code,
          redirect_uri: EBAY_RU_NAME
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: "Token exchange failed",
        details: data
      });
    }

    res.json({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}

/* ===============================
   POST — OAuth Exchange (Extension)
================================ */
app.post("/oauth/exchange", async (req, res) => {
  await exchangeCode(req.body.code, res);
});

/* ===============================
   GET — OAuth Exchange (Browser Test)
================================ */
app.get("/oauth/exchange", async (req, res) => {
  await exchangeCode(req.query.code, res);
});

/* ===============================
   REFRESH TOKEN ENDPOINT
================================ */
app.post("/oauth/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token missing" });
  }

  try {
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
          refresh_token: refreshToken,
          scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: "Refresh failed",
        details: data
      });
    }

    res.json({
      accessToken: data.access_token,
      expiresIn: data.expires_in
    });

  } catch (err) {
    res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
});

/* ===============================
   EBAY PRICE & QUANTITY UPDATE
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  const {
    accessToken,
    sku,
    price,
    quantity
  } = req.body;

  if (!accessToken || !sku || price == null || quantity == null) {
    return res.status(400).json({
      error: "Missing required fields"
    });
  }

  try {
    const response = await fetch(
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
              quantity: Number(quantity)
            }
          },
          price: {
            value: Number(price),
            currency: "GBP"
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        error: "Inventory update failed",
        details: data
      });
    }

    res.json({
      success: true,
      sku,
      price,
      quantity
    });

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
