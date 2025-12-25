app.get("/verify-ebay-token", async (req, res) => {
  try {
    if (!process.env.EBAY_USER_TOKEN) {
      return res.status(500).json({
        ok: false,
        error: "EBAY_USER_TOKEN missing in environment variables"
      });
    }

    const ebayResponse = await fetch(
      "https://api.ebay.com/ws/api.dll",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          "X-EBAY-API-CALL-NAME": "GeteBayOfficialTime",
          "X-EBAY-API-SITEID": "3",
          "X-EBAY-API-COMPATIBILITY-LEVEL": "967"
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<GeteBayOfficialTimeRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${process.env.EBAY_USER_TOKEN}</eBayAuthToken>
  </RequesterCredentials>
</GeteBayOfficialTimeRequest>`
      }
    );

    const text = await ebayResponse.text();

    // ✅ FORCE response even if empty
    if (!text || text.trim().length === 0) {
      return res.status(502).json({
        ok: false,
        error: "Empty response from eBay",
        ebayStatus: ebayResponse.status
      });
    }

    // ✅ Send RAW XML so browser won't try to parse HTML
    res.setHeader("Content-Type", "application/xml");
    return res.status(200).send(text);

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server crash",
      message: err.message
    });
  }
});
