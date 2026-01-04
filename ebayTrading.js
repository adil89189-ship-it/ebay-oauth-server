import fetch from "node-fetch";

let variationLock = Promise.resolve();

async function tradingRequest(callName, xml) {
  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1445",
      "X-EBAY-API-APP-NAME": process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-DEV-NAME": process.env.EBAY_CLIENT_ID,
      "X-EBAY-API-CERT-NAME": process.env.EBAY_CLIENT_SECRET
    },
    body: xml
  });
  return res.text();
}

function safePrice(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n < 0.99) return "0.99";
  return n.toFixed(2);
}

function safeQty(q) {
  const n = parseInt(q, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

async function getItem(itemId, token) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${itemId}</ItemID>
</GetItemRequest>`;
  return tradingRequest("GetItem", xml);
}

async function _reviseListing({ parentItemId, price, quantity, amazonSku, variationName, variationValue }) {

  const safeP = safePrice(price);
  const desiredQty = safeQty(quantity);
  const token = process.env.EBAY_TRADING_TOKEN;

  const raw = await getItem(parentItemId, token);

  const variations = [...raw.matchAll(/<Variation>[\s\S]*?<\/Variation>/g)].map(v => v[0]);

  let currentQty = 0;

  for (const v of variations) {
    if (v.includes(`<SKU>${amazonSku}</SKU>`)) {
      const m = v.match(/<Quantity>(\d+)<\/Quantity>/);
      if (m) currentQty = parseInt(m[1], 10);
      break;
    }
  }

  const delta = desiredQty - currentQty;

  const updated = variations.map(v => {
    if (!v.includes(`<SKU>${amazonSku}</SKU>`)) return v;

    return `
<Variation>
  <SKU>${amazonSku}</SKU>
  <VariationSpecifics>
    <NameValueList>
      <Name>${variationName}</Name>
      <Value>${variationValue}</Value>
    </NameValueList>
  </VariationSpecifics>
  <StartPrice>${safeP}</StartPrice>
  <Quantity>${delta}</Quantity>
</Variation>`;
  });

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${parentItemId}</ItemID>
    <Variations>${updated.join("")}</Variations>
  </Item>
</ReviseFixedPriceItemRequest>`;

  const result = await tradingRequest("ReviseFixedPriceItem", xml);

  if (result.includes("<Ack>Failure</Ack>")) {
    console.error("❌ SYNC ERROR:", result);
  } else {
    console.log("🟢 SYNC RESULT:", amazonSku, "Qty:", desiredQty);
  }

  return result;
}

export async function reviseListing(data) {
  variationLock = variationLock.then(() => _reviseListing(data));
  return variationLock;
}
