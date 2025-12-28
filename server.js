import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   INVENTORY OAUTH ENGINE
================================ */

let inventoryToken = null;
let tokenExpiry = 0;

async function getInventoryToken() {
  if (inventoryToken && Date.now() < tokenExpiry) return inventoryToken;

  const auth = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body:
      "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope/sell.inventory"
  });

  const data = await res.json();

  inventoryToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;

  return inventoryToken;
}

export { getInventoryToken };
