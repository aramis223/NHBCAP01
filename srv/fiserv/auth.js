const { fetchWithTimeout } = require('../integration/http');

async function getAccessToken() {
  const tokenUrl = process.env.FISERV_TOKEN_URL;
  const apiKey = process.env.FISERV_API_KEY;
  const apiSecret = process.env.FISERV_API_SECRET;

  if (!tokenUrl || !apiKey || !apiSecret) {
    throw new Error("Fiserv OAuth configuration is missing");
  }

  const credentials = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  const response = await fetchWithTimeout(tokenUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Fiserv OAuth failed: HTTP ${response.status} ${errorText}`
    );
  }

  const tokenData = await response.json();

  if (!tokenData.access_token) {
    throw new Error("Fiserv OAuth response did not contain an access token");
  }

  return tokenData.access_token;
}

module.exports = {
  getAccessToken
};