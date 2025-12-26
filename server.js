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
  EBAY_RU_NAME
} = process.env;

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("eBay Sync Server Running");
});

/* ===============================
   OAUTH CALLBACK
================================ */
app.get("/oauth/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
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
      console.error("❌ Token Exchange Failed:", data);
      return res.status(500).json(data);
    }

    /* ===============================
       STORE TOKEN (TEMP)
    ================================ */
    global.ebayToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      created_at: Date.now()
    };

    console.log("✅ eBay Token Stored");

    res.send(`
      <h2>Authorization successful</h2>
      <p>You may now close this window.</p>
    `);

  } catch (err) {
    console.error("❌ OAuth Error:", err);
    res.status(500).json({ error: "OAuth exchange failed" });
  }
});

/* ===============================
   INVENTORY TEST ENDPOINT
================================ */
app.post("/sync", (req, res) => {
  if (!global.ebayToken?.access_token) {
    return res.status(401).json({ error: "Not authenticated with eBay" });
  }

  res.json({
    ok: true,
    message: "Inventory update accepted",
    received: req.body
  });
});

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
