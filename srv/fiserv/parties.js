const crypto = require("crypto");
const { getAccessToken } = require("./auth");

async function getPartyList(orgId) {
    const baseUrl = process.env.FISERV_API_BASE_URL;

    if (!baseUrl) {
        throw new Error("FISERV_API_BASE_URL is not configured");
    }

    if (!orgId) {
        throw new Error("Fiserv orgId is required");
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
        `${baseUrl}/partyservice/parties/parties/secured/list`,
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
                PartyListSel: {}
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `Fiserv Get Party List failed: HTTP ${response.status} ${errorText}`
        );
    }

    const data = await response.json();

    if (!data.Status || data.Status.StatusCode !== "0") {
        throw new Error(
            `Fiserv Get Party List returned ${
                data.Status?.StatusCode || "Unknown"
            }: ${data.Status?.StatusDesc || "Unknown error"}`
        );
    }

    return data;
}

module.exports = {
    getPartyList
};