# 🕷️ ANVISA Scraper - Webshare Proxy Setup

## Architecture (SIMPLE)

```
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND ONLY                            │
│                                                             │
│  1. /api/medication/:drug  ──► Playwright + Webshare ──► ANVISA
│     (scrape PDF URL)           (bypass anti-bot)            │
│                                                             │
│  2. /api/pdf?url=...  ──────► Simple HTTP fetch ──────► ANVISA
│     (stream PDF)               (no browser, fast)           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                    Frontend (iframe)
```

**Key Points:**
- ✅ **Webshare proxy ONLY used for scraping** (getting PDF URLs)
- ✅ **PDF streaming uses simple HTTP** (no browser, fast)
- ✅ **All scraping happens on backend** (frontend never touches ANVISA)

---

## Environment Variables for Fly.io

```bash
# ONLY 3 secrets required:

# 1. MongoDB (database)
fly secrets set MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/pharmabula"

# 2. HuggingFace (LLM API)
fly secrets set PRIMARY_API_KEY="hf_xxxxxxxxxxxxxxxxxxxxx"

# 3. Webshare (ANVISA scraping proxy)
fly secrets set WEBSHARE_PROXY_URL="http://username:password@proxy.webshare.io:10000"
```

---

## Webshare Setup

### 1. Sign Up
Go to [webshare.io](https://www.webshare.io/)

### 2. Get Credentials
- **Free tier**: 2 proxies, 10GB/month
- You get: username, password, proxy URL (e.g., `proxy.webshare.io:10000`)

### 3. Format Proxy URL
```
http://username:password@proxy.webshare.io:10000
```

Example:
```
http://john_doe:abc123xyz@proxy.webshare.io:10000
```

---

## API Endpoints

### 1. Get PDF URL (uses Webshare + Playwright)

```bash
GET /api/medication/paracetamol?tipo=paciente&index=0
```

**What happens:**
1. Server launches headless browser
2. Connects through Webshare proxy (bypasses ANVISA anti-bot)
3. Scrapes ANVISA to get PDF URL
4. Returns JSON with PDF URL

**Response:**
```json
{
  "drugName": "paracetamol",
  "tipo": "paciente",
  "pdfUrl": "https://consultas.anvisa.gov.br/api-bula/...",
  "proxyUrl": "/api/pdf?url=https://..."
}
```

---

### 2. Stream PDF (simple HTTP, no browser)

```bash
GET /api/pdf?url=https://consultas.anvisa.gov.br/api-bula/...
```

**What happens:**
1. Server fetches PDF via simple HTTP GET
2. Streams PDF to client
3. No browser, no proxy needed (ANVISA doesn't block PDF requests)

**Response:** PDF file (inline in browser)

---

## Frontend Usage

```javascript
// Step 1: Get PDF URL from server
const res = await fetch('/api/medication/paracetamol?tipo=paciente');
const data = await res.json();

// Step 2: Open PDF viewer with proxy URL
const iframe = document.getElementById('pdf-viewer');
iframe.src = data.proxyUrl; // Uses /api/pdf proxy
```

---

## Why This Architecture?

### Problem
ANVISA has anti-bot protection that blocks:
- ❌ Direct HTTP requests
- ❌ Server IPs (datacenter ranges)
- ❌ Automated traffic

### Solution
1. **Webshare residential proxies** - Looks like real user traffic
2. **Playwright + Stealth** - Mimics real browser behavior
3. **Backend-only scraping** - Frontend never exposed to ANVISA

### Benefits
- ✅ No CORS issues
- ✅ No rate limiting
- ✅ Frontend is simple (just iframe)
- ✅ PDF streaming is fast (no browser overhead)

---

## Deploy Checklist

```bash
# 1. Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Create app
fly launch --no-deploy

# 4. Set secrets (ONLY THESE 3)
fly secrets set MONGODB_URI="..."
fly secrets set PRIMARY_API_KEY="..."
fly secrets set WEBSHARE_PROXY_URL="http://user:pass@proxy.webshare.io:10000"

# 5. Deploy
fly deploy
```

---

## Testing

### Local
```bash
# Install dependencies
npm install

# Set up .env
cp .env.example .env
# Edit with your Webshare credentials

# Start server
npm run dev

# Test scraping (gets PDF URL)
curl "http://localhost:8080/api/medication/paracetamol?tipo=paciente"

# Test PDF streaming
curl "http://localhost:8080/api/pdf?url=..." -o bula.pdf
```

### Production (Fly.io)
```bash
# Get your app URL
fly open

# Test endpoints
curl "https://your-app.fly.dev/api/medication/paracetamol?tipo=paciente"
```

---

## Troubleshooting

### "Nenhum resultado encontrado"
- ANVISA blocked the proxy
- Try a different Webshare proxy location
- Wait a few minutes and retry

### "URL do PDF não encontrada"
- Medication may not have patient bula
- Try `tipo=profissional` instead

### Proxy authentication failed
- Check format: `http://user:pass@host:port`
- Verify credentials in Webshare dashboard

---

## Summary

| Component | Uses Webshare? | Uses Browser? | Purpose |
|-----------|---------------|---------------|---------|
| `/api/medication/:drug` | ✅ Yes | ✅ Yes (Playwright) | Scrape PDF URL |
| `/api/pdf?url=...` | ❌ No | ❌ No (simple HTTP) | Stream PDF |
| `/api/chat` | ❌ No | ❌ No | Chat with AI |

**Webshare is ONLY used for scraping ANVISA to get PDF URLs. Nothing else.**

---

**That's it! No fuckying shit up. 🎯**
