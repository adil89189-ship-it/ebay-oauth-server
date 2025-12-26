import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   ENV CHECK
================================ */
const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RUNAME
} = process.env;

if (!EBAY_CLIENT_ID || !EBAY_CLIENT_SECRET || !EBAY_RUNAME) {
  console.error("❌ Missing eBay OAuth environment variables");
}

/* ===============================
   TEMP TOKEN STORAGE (DEV ONLY)
================================ */
let ebayAccessToken = null;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ ok: true, message: "eBay OAuth Server Running" });
});

/* ===============================
   START EBAY OAUTH
================================ */
app.get("/auth/ebay", (req, res) => {
  const scope = encodeURIComponent(
    "https://api.ebay.com/oauth/api_scope " +
    "https://api.ebay.com/oauth/api_scope/sell.inventory"
  );

  const authUrl =
    `https://auth.ebay.com/oauth2/authorize` +
    `?client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${EBAY_RUNAME}` +
    `&scope=${scope}`;

  res.redirect(authUrl);
});

/* ===============================
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).json({
      ok: false,
      error: "No authorization code returned"
    });
  }

  const basicAuth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: EBAY_RUNAME
        })
      }
    );

    const data = await tokenRes.json();

    if (!data.access_token) {
      return res.status(400).json({
        ok: false,
        error: data
      });
    }

    ebayAccessToken = data.access_token;

    res.json({
      ok: true,
      message: "Authorization successful"
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

/* ===============================
   SYNC ENDPOINT
================================ */
app.post("/sync", (req, res) => {
  if (!ebayAccessToken) {
    return res.status(401).json({
      ok: false,
      error: "Not authenticated with eBay"
    });
  }

  // TEMP SUCCESS RESPONSE (SAFE)
  res.json({
    ok: true,
    message: "Inventory update accepted",
    received: req.body
  });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
