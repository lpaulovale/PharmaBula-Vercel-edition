const { MongoClient } = require("mongodb");

let cachedClient = null;

async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  if (cachedClient) {
    try {
      // Verify the cached connection is still alive
      await cachedClient.db("admin").command({ ping: 1 });
      return cachedClient;
    } catch {
      cachedClient = null;
    }
  }

  try {
    const client = new MongoClient(uri, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      retryWrites: true,
      minPoolSize: 0,
      maxPoolSize: 1,
    });
    await client.connect();
    cachedClient = client;
    return client;
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    return null;
  }
}

async function getSessionsCollection() {
  const client = await getMongoClient();
  if (!client) return null;
  return client.db("pharmabula").collection("sessions");
}

module.exports = { getMongoClient, getSessionsCollection };
