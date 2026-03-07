/**
 * MongoDB Data API client.
 * Uses HTTP requests instead of the MongoDB driver,
 * avoiding TLS/SSL issues on Vercel serverless.
 */

async function dataApiRequest(action, body) {
  const apiKey = process.env.MONGODB_DATA_API_KEY;
  const appId = process.env.MONGODB_DATA_APP_ID;

  if (!apiKey || !appId) {
    console.log("MongoDB Data API skipped: Missing MONGODB_DATA_API_KEY or MONGODB_DATA_APP_ID");
    return null;
  }

  // Use the new standard URL format (works across all regions)
  const url = `https://data.mongodb-api.com/app/${appId}/endpoint/data/v1/action/${action}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        "Access-Control-Request-Headers": "*",
      },
      body: JSON.stringify({
        dataSource: "Cluster0",
        database: "pharmabula",
        collection: "sessions",
        ...body,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`MongoDB Data API Error (${res.status}):`, errorText, "\nURL:", url);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("MongoDB Data API request failed entirely:", err.message);
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
