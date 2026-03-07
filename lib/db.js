const { MongoClient } = require("mongodb");

let cachedClient = null;

/**
 * Get a cached MongoDB client connection.
 * Returns null if MONGODB_URI is not configured (graceful degradation).
 */
async function getMongoClient() {
    const uri = process.env.MONGODB_URI;
    if (!uri) return null;

    if (cachedClient) return cachedClient;

    const client = new MongoClient(uri);
    await client.connect();
    cachedClient = client;
    return client;
}

/**
 * Get the pharmabula database sessions collection.
 * Returns null if MongoDB is not configured.
 */
async function getSessionsCollection() {
    const client = await getMongoClient();
    if (!client) return null;
    return client.db("pharmabula").collection("sessions");
}

module.exports = { getMongoClient, getSessionsCollection };
