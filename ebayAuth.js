import fetch from "node-fetch";
import { saveToken } from "./tokenStore.js";

const {
  EBAY_CLIENT_ID,
  EBAY_CLIENT_SECRET,
  EBAY_RUNAME
} = process.env;

export function buildAuthUrl() {
  return `https://auth.ebay.com/oauth2/authorize?` +
    `client_id=${EBAY_CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${EBAY_RUNAME}` +
    `&scope=https://api.ebay.com/oauth/api_scope/sell.inventory`;
}

export async function exchangeCodeForToken(code) {
  const creds = Buffer.from(
    `${EBAY_CLIENT_ID}:${EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: EBAY_RUNAME
    })
  });

  const data = await res.json();
  if (!data.access_token) return { ok: false, data };

  saveToken(data);
  return { ok: true };
}
