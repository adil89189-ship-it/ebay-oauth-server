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
  EBAY_RU_NAME,
  EBAY_REFRESH_TOKEN,
  EBAY_ENV
} = process.env;

const EBAY_OAUTH_URL =
  EBAY_ENV === "production"
    ? "https://api.ebay.com"
    : "https://api.sandbox.ebay.com";

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("✅ eBay Sync Server Running (OPTION A)");
});

/* ===============================
   STEP 1: AUTH URL (ONE TIME)
================================ */
app.get("/oauth/start", (req, res) => {
  const scope = encodeURIComponent(
    "https://api.ebay.com/oauth/api_scope/sell.inventory https://api.ebay.com/oauth/api_scope"
  );

  const url = `https://www.ebay.com/identity/v1/oauth2/authorize?response_type=code&client_id=${EBAY_CLIENT_ID}&redirect_uri=${EBAY_RU_NAME}&scope=${scope}`;

  res.redirect(url);
});

/* ===============================
   STEP 2: CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send("❌ Missing code");

  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_OAUTH_URL}/identity/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: EBAY_RU_NAME
      })
    }
  );

  const data = await response.json();

  if (!data.refresh_token) {
    console.error(data);
    return res.send("❌ Token exchange failed");
  }

  console.log("✅ SAVE THIS REFRESH TOKEN:");
  console.log(data.refresh_token);

  res.send(
    "✅ OAuth Success. Copy refresh_token from server logs and save to Render ENV."
  );
});

/* ===============================
   TOKEN REFRESH (AUTO)
================================ */
async function getAccessToken() {
  const auth = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${EBAY_OAUTH_URL}/identity/v1/oauth2/token`,
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
    throw new Error("❌ Failed to refresh eBay token");
  }

  return data.access_token;
}

/* ===============================
   SYNC ENDPOINT (EXTENSION)
================================ */
app.post("/sync", async (req, res) => {
  try {
    const { amazonSku, amazonPrice, quantity } = req.body;

    if (!amazonSku || amazonPrice == null) {
      return res.status(400).json({ ok: false, message: "Invalid payload" });
    }

    const accessToken = await getAccessToken();

    // 🚧 Inventory update will be added NEXT STEP
    console.log("🔄 SYNC RECEIVED", {
      amazonSku,
      amazonPrice,
      quantity,
      accessToken: "OK"
    });

    res.json({
      ok: true,
      message: "Sync accepted (inventory update coming next)",
      received: { amazonSku, amazonPrice, quantity }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
