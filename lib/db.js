/**
 * MongoDB Data API client.
 * Uses HTTP requests instead of the MongoDB driver,
 * avoiding TLS/SSL issues on Vercel serverless.
 *
 * Setup: Enable Data API on MongoDB Atlas:
 *   Atlas → Data API (left menu) → Enable
 *   Copy the App ID and generate an API Key
 *
 * Env vars needed:
 *   MONGODB_DATA_API_KEY  - API key from Atlas Data API
 *   MONGODB_DATA_APP_ID   - App ID (e.g. "data-xxxxx")
 */

const DATA_API_BASE = "https://data.mongodb-api.com/app";

async function dataApiRequest(action, body) {
  const apiKey = process.env.MONGODB_DATA_API_KEY;
  const appId = process.env.MONGODB_DATA_APP_ID;

  if (!apiKey || !appId) return null;

  const url = `${DATA_API_BASE}/${appId}/endpoint/data/v1/action/${action}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        dataSource: "Cluster0",
        database: "pharmabula",
        collection: "sessions",
        ...body,
      }),
    });

    if (!res.ok) {
      console.error("Data API error:", res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Data API request failed:", err.message);
    return null;
  }
}

async function findSession(sessionId) {
  const result = await dataApiRequest("findOne", {
    filter: { sessionId },
  });
  return result?.document || null;
}

async function saveMessages(sessionId, newMessages, mode) {
  await dataApiRequest("updateOne", {
    filter: { sessionId },
    update: {
      $push: { messages: { $each: newMessages } },
      $set: { lastActive: { $date: new Date().toISOString() }, mode },
      $setOnInsert: { createdAt: { $date: new Date().toISOString() } },
    },
    upsert: true,
  });
}

module.exports = { findSession, saveMessages };
