import fs from "fs";

const FILE = "./token.json";

export function saveToken(token) {
  fs.writeFileSync(FILE, JSON.stringify(token, null, 2));
}

export function loadToken() {
  if (fs.existsSync(FILE)) {
    return JSON.parse(fs.readFileSync(FILE));
  }

  if (process.env.EBAY_REFRESH_TOKEN) {
    return { refresh_token: process.env.EBAY_REFRESH_TOKEN };
  }

  return null;
}
