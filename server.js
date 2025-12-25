app.get("/verify-ebay-token", async (req, res) => {
  const EBAY_TOKEN = process.env.EBAY_USER_TOKEN;

  if (!EBAY_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: "EBAY_USER_TOKEN missing in environment variables"
    });
  }

  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${EBAY_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
</GeteBayOfficialTimeRequest>`;

  try {
    const ebayResponse = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "X-EBAY-API-CALL-NAME": "GeteBayOfficialTime",
        "X-EBAY-API-SITEID": "0",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
      },
      body: xmlRequest
    });

    const responseText = await ebayResponse.text();

    // ✅ CRITICAL: force XML so browser does NOT try to parse as HTML
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.status(200).send(responseText);

  } catch (error) {
    console.error("❌ Token verification failed:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
