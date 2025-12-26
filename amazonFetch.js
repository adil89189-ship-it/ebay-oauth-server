import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Fetch Amazon price & availability by ASIN
 */
export async function fetchAmazonData(asin) {
  if (!asin) {
    throw new Error("ASIN is required");
  }

  const url = `https://www.amazon.co.uk/dp/${asin}`;

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept-Language": "en-GB,en;q=0.9",
  };

  const response = await axios.get(url, {
    headers,
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);

  let priceText =
    $("#priceblock_ourprice").text() ||
    $("#priceblock_dealprice").text() ||
    $("span.a-price span.a-offscreen").first().text();

  const availability = $("#availability span").text().trim();

  if (!priceText) {
    throw new Error("Price not found (Amazon layout or bot protection)");
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
}
