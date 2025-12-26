import express from "express";
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
  EBAY_RU_NAME
} = process.env;

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
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        ok: false,
        error: "Missing authorization code"
      });
    }

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
      console.error("❌ Token exchange failed:", data);
      return res.status(500).json({
        ok: false,
        error: "Token exchange failed",
        details: data
      });
    }

    /* ===============================
       STORE TOKEN (TEMP - MEMORY)
    ================================ */
    global.ebayToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      created_at: Date.now()
    };

    console.log("✅ eBay token stored");

    res.json({
      ok: true,
      message: "Authorization successful"
    });

  } catch (err) {
    console.error("❌ OAuth callback error:", err);
    res.status(500).json({
      ok: false,
      error: "OAuth callback failed",
      details: err.message
    });
  }
});

/* ===============================
   SYNC ENDPOINT (ALWAYS JSON)
================================ */
app.post("/sync", (req, res) => {
  try {
    if (!global.ebayToken?.access_token) {
      return res.status(401).json({
        ok: false,
        error: "Not authenticated with eBay"
      });
    }

    res.json({
      ok: true,
      message: "Inventory update accepted",
      received: req.body
    });

  } catch (err) {
    console.error("❌ Sync error:", err);
    res.status(500).json({
      ok: false,
      error: "Sync failed",
      details: err.message
    });
  }
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
