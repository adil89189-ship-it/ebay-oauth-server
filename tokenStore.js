import fs from "fs";

const FILE = "./token.json";

export function saveToken(token) {
  fs.writeFileSync(FILE, JSON.stringify(token, null, 2));
}

export function loadToken() {
  // 1️⃣ Try file first
  if (fs.existsSync(FILE)) {
    return JSON.parse(fs.readFileSync(FILE));
  }

  // 2️⃣ Fallback to environment refresh token (Render-safe)
  if (process.env.EBAY_REFRESH_TOKEN) {
    return {
      refresh_token: process.env.EBAY_REFRESH_TOKEN
    };
  }

  return null;
}
