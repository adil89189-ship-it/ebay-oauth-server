import fetch from "node-fetch";

let cachedToken = null;
let tokenExpiry = 0;

/**
 * Returns a valid eBay access token
 * Auto-refreshes when expired
 * Caches token in memory (~2 hours)
 */
export async function getEbayAccessToken() {
  const now = Date.now();

  // ✅ Use cached token if valid
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  console.log("🔄 Refreshing eBay access token...");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.EBAY_REFRESH_TOKEN,
    scope: "https://api.ebay.com/oauth/api_scope/sell.inventory"
  });

  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.EBAY_CLIENT_ID +
              ":" +
              process.env.EBAY_CLIENT_SECRET
          ).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const raw = await response.text();

  if (!raw) {
    throw new Error("eBay token endpoint returned empty body");
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON from eBay token endpoint");
  }

  if (!data.access_token) {
    throw new Error("No access_token in eBay response");
  }

  cachedToken = data.access_token;

  // ⏱ cache ~110 minutes (safe margin)
  tokenExpiry = now + 1000 * 60 * 110;

  console.log("✅ eBay token refreshed and cached");

  return cachedToken;
}
