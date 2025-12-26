import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Fetch Amazon UK price & availability by ASIN
 * Backend-only (no browser)
 */
export async function fetchAmazonData(asin) {
  if (!asin) {
    throw new Error("ASIN is required");
  }

  const url = `https://www.amazon.co.uk/dp/${asin}`;

  try {
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "en-GB,en;q=0.9",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

        /**
         * 🔴 CRITICAL: Force Amazon UK location + currency
         * Without this, Amazon hides prices
         */
        "Cookie":
          "i18n-prefs=GBP; lc-acbuk=en_GB; ubid-acbuk=130-1234567-1234567",
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    /**
     * PRICE SELECTORS (fallback chain)
     */
    let priceText =
      $("#priceblock_ourprice").text() ||
      $("#priceblock_dealprice").text() ||
      $("#price_inside_buybox").text() ||
      $("span.a-price span.a-offscreen").first().text();

    /**
     * AVAILABILITY
     */
    const availability =
      $("#availability span").text().trim() ||
      $("div#availability").text().trim();

    if (!priceText) {
      throw new Error(
        "Price not found (blocked, variation item, or delivery restriction)"
      );
    }

    const price = parseFloat(
      priceText.replace("£", "").replace(",", "").trim()
    );

    return {
      asin,
      price,
      availability,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw new Error(`Amazon fetch failed: ${err.message}`);
  }
}
