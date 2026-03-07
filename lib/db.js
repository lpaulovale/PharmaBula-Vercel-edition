const { MongoClient } = require("mongodb");

let cachedClient = null;

/**
 * Get a cached MongoDB client connection.
 * Returns null if MONGODB_URI is not configured or connection fails.
 */
async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (cachedClient) return cachedClient;

  try {
    const client = new MongoClient(uri, {
      tls: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    cachedClient = client;
    return client;
  } catch (err) {
    console.error("MongoDB connection failed (chat will work without persistence):", err.message);
    return null;
  }
}

/**
 * Get the pharmabula database sessions collection.
 * Returns null if MongoDB is not available.
 */
async function getSessionsCollection() {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db("pharmabula").collection("sessions");
}

module.exports = { getMongoClient, getSessionsCollection };
