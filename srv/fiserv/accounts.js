const { fetchWithTimeout } = require('../integration/http');
const crypto = require("crypto");
const { getAccessToken } = require("./auth");

async function getAccountDetails(accountId, orgId) {
  const baseUrl = process.env.FISERV_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("FISERV_API_BASE_URL is not configured");
  }

  if (!accountId) {
    throw new Error("Fiserv accountId is required");
  }

  if (!orgId) {
    throw new Error("Fiserv orgId is required");
  }

  const accessToken = await getAccessToken();

  const response = await fetchWithTimeout(
    `${baseUrl}/acctservice/acctmgmt/accounts/secured`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        EFXHeader: JSON.stringify({
          OrganizationId: orgId,
          TrnId: crypto.randomUUID()
        })
      },
      body: JSON.stringify({
        AcctSel: {
          AcctKeys: {
            AcctId: accountId,
            AcctType: "DDA"
          }
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Fiserv Get Account Details failed: HTTP ${response.status} ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.Status || data.Status.StatusCode !== "0") {
    throw new Error(
      `Fiserv Get Account Details returned ${
        data.Status?.StatusCode || "Unknown"
      }: ${data.Status?.StatusDesc || "Unknown error"}`
    );
  }

  return data;
}

module.exports = {
  getAccountDetails
};