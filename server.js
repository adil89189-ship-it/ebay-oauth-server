import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV CHECK
================================ */
const {
  EBAY_APP_ID,
  EBAY_DEV_ID,
  EBAY_CERT_ID,
  EBAY_USER_TOKEN
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("🟢 eBay OAuth Server Running");
});

/* ===============================
   DEBUG ENV
================================ */
app.get("/debug-env", (req, res) => {
  res.json({
    hasAppId: !!EBAY_APP_ID,
    hasDevId: !!EBAY_DEV_ID,
    hasCertId: !!EBAY_CERT_ID,
    hasUserToken: !!EBAY_USER_TOKEN
  });
});

/* ===============================
   VERIFY TOKEN
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  try {
    const response = await fetch(
      "https://api.ebay.com/ws/api.dll",
      {
        method: "POST",
        headers: {
          "X-EBAY-API-CALL-NAME": "GeteBayOfficialTime",
          "X-EBAY-API-SITEID": "0",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
          "Content-Type": "text/xml",
          "X-EBAY-API-IAF-TOKEN": EBAY_USER_TOKEN
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
            <RequesterCredentials>
              <eBayAuthToken>${EBAY_USER_TOKEN}</eBayAuthToken>
            </RequesterCredentials>
          </GeteBayOfficialTimeRequest>`
      }
    );

    const text = await response.text();
    res.type("text/xml").send(text);

  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   UPDATE INVENTORY (TEST)
================================ */
app.post("/ebay/update-inventory", async (req, res) => {
  const { amazonSku, amazonPrice, quantity } = req.body;

  if (!amazonSku || !amazonPrice || !quantity || !EBAY_USER_TOKEN) {
    return res.json({
      ok: false,
      error: "Missing sku, price, quantity, or accessToken"
    });
  }

  // Placeholder — inventory logic comes later
  res.json({
    ok: true,
    message: "Inventory update accepted",
    received: { amazonSku, amazonPrice, quantity }
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
