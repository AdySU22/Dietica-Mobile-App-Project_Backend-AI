const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {db} = require("../core/firestore");
const {Timestamp} = require("firebase-admin/firestore");

exports.fatsecretSearch = onCall({
  vpcConnector: "dietica-connector",
  vpcConnectorEgressSettings: "ALL_TRAFFIC",
}, async (request) => {
  const {query, page, limit} = request.data;
  if (!query || typeof query !== "string") {
    throw new HttpsError("invalid-argument", "query must not empty");
  }
  if (page === null || page === undefined || typeof page !== "number") {
    throw new HttpsError("invalid-argument", "page must not empty");
  }
  if (!limit || typeof limit !== "number") {
    throw new HttpsError("invalid-argument", "limit must not empty");
  }

  const url = `https://platform.fatsecret.com/rest/foods/search/v1`;
  const params = new URLSearchParams({
    search_expression: query,
    page_number: page.toString(),
    max_results: limit.toString(),
    format: "json",
  });
  const fullUrl = `${url}?${params.toString()}`;
  const accessToken = await fatsecretGetToken();

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new HttpsError(
        "internal",
        `Error accessing FatSecret GET /foods/search: ${response.status}`,
    );
  }

  const data = await response.json();
  logger.log("FatSecret GET /foods/search:", data);
  return data;
});

exports.fatsecretGet = onCall({
  vpcConnector: "dietica-connector",
  vpcConnectorEgressSettings: "ALL_TRAFFIC",
}, async (request) => {
  const {foodId} = request.data;
  if (!foodId || typeof foodId !== "string") {
    throw new HttpsError("invalid-argument", "query must not empty");
  }

  const url = `https://platform.fatsecret.com/rest/food/v4`;
  const params = new URLSearchParams({
    food_id: foodId,
    format: "json",
  });
  const fullUrl = `${url}?${params.toString()}`;
  const accessToken = await fatsecretGetToken();

  const response = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new HttpsError(
        "internal",
        `Error accessing FatSecret GET /food: ${response.status}`,
    );
  }

  const data = await response.json();
  logger.log("FatSecret GET /food:", data);
  return data;
});

const fatsecretGetToken = async () => {
  const fatsecretTokens = await db.collection("FatsecretToken")
      .orderBy("expiredAt", "desc")
      .limit(1)
      .get();
  // if token in database is still valid
  if (fatsecretTokens.docs.length > 0 &&
        fatsecretTokens.docs[0].data().expiredAt.toDate() > new Date()) {
    return fatsecretTokens.docs[0].data().token;
  }

  const url = "https://oauth.fatsecret.com/connect/token";
  const clientID = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  const headers = {
    "Authorization": "Basic " +
        Buffer.from(`${clientID}:${clientSecret}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const body = new URLSearchParams({
    "grant_type": "client_credentials",
    "scope": "basic",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: body,
  });

  if (!response.ok) {
    logger.error(
        "Error fetching FatSecret access token:",
        response.status,
        response.statusText,
    );
    throw new HttpsError(
        "internal",
        `Error accessing FatSecret API: ${response.status}`,
    );
  }

  const data = await response.json();
  logger.log("FatSecret POST /token:", data);

  await db.collection("FatsecretToken").add({
    token: data.access_token,
    expiredAt: Timestamp.fromDate(new Date(
        Date.now() + data.expires_in * 1000,
    )),
  });

  return data.access_token;
};
