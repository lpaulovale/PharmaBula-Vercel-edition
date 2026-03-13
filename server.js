/**
 * PharmaBula AI - Express Server for Fly.io
 * 
 * This server provides:
 * - Static file serving for the frontend
 * - API endpoints for chat and evaluation
 * - PDF proxy endpoint for viewing ANVISA bulas
 */

const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const cors = require('cors');

// Import API handlers
const chatHandler = require('./api/chat');
const evaluateHandler = require('./api/evaluate');

// Import ANVISA scraper (ONLY for getting PDF URLs)
const { getPdfUrl } = require('./lib/anvisa-scraper');

const app = express();
const PORT = process.env.PORT || 8080;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

// PDF Proxy Endpoint - Stream PDFs from ANVISA (no browser, simple HTTP fetch)
app.get('/api/pdf', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Validate URL is from ANVISA domain
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('anvisa.gov.br')) {
      return res.status(403).json({ error: 'Only ANVISA PDF URLs are allowed' });
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="bula.pdf"');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Simple HTTP fetch (no browser needed for this)
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/pdf',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || 'application/pdf';
    res.setHeader('Content-Type', contentType);
    
    // Stream the PDF
    if (response.body) {
      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const arrayBuffer = await response.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    }
    
  } catch (error) {
    console.error('PDF proxy error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch PDF', 
      message: error.message 
    });
  }
});

// Get PDF URL from ANVISA (uses Webshare proxy + Playwright for scraping)
app.get('/api/medication/:drugName', async (req, res) => {
  try {
    const { drugName } = req.params;
    const { tipo = 'paciente', index = 0 } = req.query;
    
    // Scrape ANVISA to get PDF URL (this is where Webshare proxy is used)
    const pdfUrl = await getPdfUrl(drugName, parseInt(index), tipo);
    
    res.json({
      drugName,
      tipo,
      pdfUrl,
      proxyUrl: `/api/pdf?url=${encodeURIComponent(pdfUrl)}`,
    });
  } catch (error) {
    console.error('[API] Get PDF URL error:', error.message);
    res.status(404).json({ error: error.message });
  }
});

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
║   - POST /api/chat      → Chat API                        ║
║   - POST /api/evaluate  → Evaluation API                  ║
║   - GET  /api/pdf?url=  → PDF Viewer Proxy                ║
║   - GET  /health        → Health Check                    ║
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
