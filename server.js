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
   OAUTH TOKEN EXCHANGE
   Called by extension after login
================================ */
app.post("/oauth/exchange", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Authorization code missing" });
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
      return res.status(400).json({
        error: "Token exchange failed",
        details: data
      });
    }

    /*
      data contains:
      - access_token (expires in 2h)
      - refresh_token (LONG-LIVED)
      - expires_in
    */

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
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
