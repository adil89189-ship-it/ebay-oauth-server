app.get("/oauth/callback", async (req, res) => {
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
});
