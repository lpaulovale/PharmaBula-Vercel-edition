/**
 * PharmaBula AI - Express Server for Fly.io
 *
 * This server provides:
 * - Static file serving for the frontend
 * - API endpoints for chat and evaluation
 *
 * All bula data comes from MongoDB - no web scraping.
 */

const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const cors = require('cors');

// Import API handlers
const chatHandler = require('./api/chat');
const evaluateHandler = require('./api/evaluate');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for proper IP detection
app.set('trust proxy', true);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.post('/api/chat', chatHandler);
app.post('/api/evaluate', evaluateHandler);

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB connection for session management
let db;
let sessionsCollection;

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.warn('⚠️  MONGODB_URI not set. Database features disabled.');
    return;
  }
  
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db();
    sessionsCollection = db.collection('sessions');
    console.log('✅ Connected to MongoDB');
    
    // Make collection available to other modules
    const { setSessionsCollection } = require('./lib/db');
    setSessionsCollection(sessionsCollection);
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
}

// Start server
async function startServer() {
  await connectToDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪💊 PharmaBula AI Server                               ║
║                                                           ║
║   Running on: http://localhost:${PORT}                     ║
║   Environment: ${process.env.NODE_ENV || 'development'}
║                                                           ║
║   Endpoints:                                              ║
║   - GET  /              → Frontend                        ║
║   - POST /api/chat      → Chat API (MongoDB)              ║
║   - POST /api/evaluate  → Evaluation API                  ║
║   - GET  /health        → Health Check                    ║
║                                                           ║
║   Data Source: MongoDB (no web scraping)                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer().catch(console.error);
