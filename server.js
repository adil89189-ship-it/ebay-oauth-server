import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV
================================ */
const EBAY_USER_TOKEN = process.env.EBAY_USER_TOKEN;
const EBAY_APP_ID = process.env.EBAY_APP_ID;
const EBAY_DEV_ID = process.env.EBAY_DEV_ID;
const EBAY_CERT_ID = process.env.EBAY_CERT_ID;

/* ===============================
   HEALTH
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay Trading API Server Running" });
});

/* ===============================
   DEBUG ENV
================================ */
app.get("/debug-env", (req, res) => {
  res.json({
    hasUserToken: !!EBAY_USER_TOKEN,
    hasAppId: !!EBAY_APP_ID,
    hasDevId: !!EBAY_DEV_ID,
    hasCertId: !!EBAY_CERT_ID
  });
});

/* ===============================
   VERIFY EBAY TOKEN (Trading API)
================================ */
app.get("/verify-ebay-token", async (req, res) => {
  if (!EBAY_USER_TOKEN || !EBAY_APP_ID || !EBAY_DEV_ID || !EBAY_CERT_ID) {
    return res.status(500).json({
      ok: false,
      error: "Missing one or more eBay credentials"
    });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_USER_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
</GeteBayOfficialTimeRequest>`;

  try {
    const response = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "GeteBayOfficialTime",
        "X-EBAY-API-SITEID": "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-APP-NAME": EBAY_APP_ID,
        "X-EBAY-API-DEV-NAME": EBAY_DEV_ID,
        "X-EBAY-API-CERT-NAME": EBAY_CERT_ID
      },
      body: xml
    });

    const text = await response.text();
    res.type("text/xml").send(text);

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
