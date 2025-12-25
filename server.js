import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RU_NAME
} = process.env;

// TEMP storage (OK for now)
let accessToken = null;

/* =========================
   EXCHANGE CODE → TOKEN
========================= */
app.post("/oauth/exchange", async (req, res) => {
  const { code } = req.body;

  try {
    const tokenRes = await fetch(
      "https://api.ebay.com/identity/v1/oauth2/token",
      app.post("/update-ebay-item", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  if (!itemId || price == null || quantity == null) {
    return res.status(400).json({ error: "Missing itemId, price or quantity" });
  }

  try {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_USER_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
  <Item>
    <ItemID>${itemId}</ItemID>
    <StartPrice>${price}</StartPrice>
    <Quantity>${quantity}</Quantity>
  </Item>
</ReviseItemRequest>`;

    const response = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "ReviseItem",
        "X-EBAY-API-SITEID": "3",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
      },
      body: xml
    });

    const text = await response.text();
    res.json({ success: true, ebayResponse: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "eBay update failed" });
  }
});
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
            ).toString("base64")
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: EBAY_RU_NAME
        })
      }
    );

    const data = await tokenRes.json();
    accessToken = data.access_token;

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   UPDATE PRICE + QTY
========================= */
app.post("/ebay/update", async (req, res) => {
  const { itemId, price, quantity } = req.body;

  if (!accessToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <InventoryStatus>
    <ItemID>${itemId}</ItemID>
    <Quantity>${quantity}</Quantity>
    <StartPrice>${price}</StartPrice>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;

  try {
    const resp = await fetch(
      "https://api.ebay.com/ws/api.dll",
      {
        method: "POST",
        headers: {
          "X-EBAY-API-CALL-NAME": "ReviseInventoryStatus",
          "X-EBAY-API-SITEID": "3",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
          "Content-Type": "text/xml"
        },
        body: xml
      }
    );

    const text = await resp.text();
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("eBay backend running"));
