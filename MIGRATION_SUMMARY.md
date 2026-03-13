# 📋 Migration Summary: Vercel → Fly.io

## ✅ Completed Changes

### 1. Docker Support
- **Created**: `Dockerfile` - Multi-stage build optimized for production
- **Created**: `.dockerignore` - Excludes unnecessary files from build
- **Features**: 
  - Alpine-based for smaller image size
  - Chromium pre-installed for browser automation
  - Health check endpoint configured

### 2. Fly.io Configuration
- **Created**: `fly.toml` - Fly.io deployment configuration
- **Settings**:
  - Region: `gru` (São Paulo, Brazil)
  - VM: 1GB RAM, 1 CPU
  - Auto-scaling enabled
  - HTTPS forced

### 3. Express.js Server
- **Created**: `server.js` - Main server entry point
- **Features**:
  - Static file serving
  - PDF proxy endpoint (`/api/pdf`)
  - Health check (`/health`)
  - MongoDB connection management
  - CORS support

### 4. PDF Viewer Integration
- **Updated**: `public/index.html`
  - PDF viewer modal with iframe
  - Uses proxy endpoint to avoid CORS
  - Download button for PDFs
  - Escape key to close modal

- **Added**: PDF proxy in `server.js`
  - Streams PDFs from ANVISA
  - Validates URLs (only anvisa.gov.br)
  - Proper headers for inline viewing

### 5. Package Updates
- **Updated**: `package.json`
  - Added `cors` dependency
  - New scripts: `docker:build`, `docker:run`, `fly:deploy`, `fly:logs`
  - Changed from Vercel to Express.js

### 6. Database Module
- **Updated**: `lib/db.js`
  - Added `setSessionsCollection()` function
  - Supports direct collection injection from server

### 7. Documentation
- **Updated**: `README.md`
  - Fly.io deployment instructions
  - Docker usage guide
  - PDF viewer documentation
  - Updated API reference

- **Created**: `DEPLOYMENT.md`
  - Step-by-step Fly.io guide
  - Troubleshooting section
  - Cost estimation
  - CI/CD setup

---

## 🗑️ Removed/Deprecated

- **Vercel CLI** - No longer needed
- **Serverless functions** - Replaced with Express.js
- **vercel.json** - Still present but not used (can be deleted)

---

## 📦 New Files Created

```
Dockerfile           # Container configuration
fly.toml             # Fly.io deployment config
server.js            # Express.js server
.dockerignore        # Docker build exclusions
DEPLOYMENT.md        # Deployment guide
MIGRATION_SUMMARY.md # This file
```

---

## 🔧 How to Use

### Local Development

```bash
# Install dependencies
npm install

# Start server
npm run dev

# Access at http://localhost:8080
```

### Docker (Local Testing)

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run
```

### Deploy to Fly.io

```bash
# Login
fly auth login

# Create app
fly launch --no-deploy

# Set secrets
fly secrets set MONGODB_URI="..."
fly secrets set PRIMARY_API_KEY="..."

# Deploy
fly deploy
```

---

## 🎯 PDF Viewer Feature

### How It Works

1. User asks about medication
2. Chat API returns response with `pdfUrl` in metadata
3. Frontend shows "Abrir PDF" button
4. Click opens modal with iframe
5. iframe loads from `/api/pdf?url=...` (proxy)
6. Proxy streams PDF from ANVISA

### Benefits

- ✅ No CORS issues
- ✅ Secure (validates ANVISA domain)
- ✅ Cached responses
- ✅ Download option available

---

## 📊 Architecture Comparison

### Before (Vercel)

```
User → Vercel Edge → /api/chat (serverless)
                   → /api/evaluate (serverless)
                   → public/ (static)
```

### After (Fly.io)

```
User → Fly.io VM → Express.js Server
                  ├─ /api/chat
                  ├─ /api/evaluate
                  ├─ /api/pdf (proxy)
                  └─ public/ (static)
```

**Advantages:**
- No cold starts
- No 10s timeout limit
- Full control over runtime
- Better for long-running operations (PDF processing)

---

## 🚨 Breaking Changes

None! The API endpoints remain the same:
- `POST /api/chat` - Same signature
- `POST /api/evaluate` - Same signature
- New: `GET /api/pdf?url=` - PDF proxy

Frontend is backward compatible.

---

## 📝 Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection | `mongodb+srv://...` |
| `PRIMARY_API_KEY` | HuggingFace token | `hf_xxx` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `FALLBACK_API_KEY` | Fallback LLM key | - |
| `PORT` | Server port | `8080` |
| `NODE_ENV` | Environment | `production` |

---

## 🎉 Next Steps

1. **Test locally**: `npm run dev`
2. **Deploy to Fly.io**: Follow `DEPLOYMENT.md`
3. **Configure MongoDB**: Set up Atlas cluster
4. **Add API keys**: HuggingFace tokens
5. **Test PDF viewer**: Search for medication and click "Abrir PDF"

---

## 📞 Support

- **Deployment Guide**: See `DEPLOYMENT.md`
- **Fly.io Docs**: https://fly.io/docs
- **Issues**: Check `fly logs` for errors

---

**Migration completed successfully! 🎊**
