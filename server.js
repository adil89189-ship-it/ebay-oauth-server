import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.EBAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET;
const RUNAME = process.env.EBAY_RUNAME;

// 🟢 Start OAuth
app.get("/auth", (req, res) => {
  const url =
    `https://auth.ebay.com/oauth2/authorize?` +
    `client_id=${CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${RUNAME}` +
    `&scope=https://api.ebay.com/oauth/api_scope`;

  res.redirect(url);
});

// 🟢 Token exchange logic (shared)
async function handleCallback(req, res) {
  const code = req.query.code;

  if (!code) {
    return res.send("❌ Missing authorization code");
  }

  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
    },
    body:
      `grant_type=authorization_code&` +
      `code=${code}&` +
      `redirect_uri=${RUNAME}`
  });

  const data = await tokenRes.json();
  console.log("🧾 TOKEN DATA:", data);

  if (!data.access_token) {
    return res.send("❌ Token exchange failed");
  }

  global.ebayToken = data;

  res.send("✅ eBay connected successfully. You may close this window.");
}

// 🟢 Accept both callback paths
app.get("/callback", handleCallback);
app.get("/oauth/callback", handleCallback);

// 🟢 Test auth status
app.get("/status", (req, res) => {
  if (!global.ebayToken) {
    return res.json({ ok: false, message: "Not authenticated" });
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
