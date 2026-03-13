# 🕷️ ANVISA Scraper with Webshare Proxy

## Overview

This project now includes a **Playwright-based scraper** to bypass ANVISA's anti-bot protection and fetch PDF bulas directly.

---

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│   Server    │ ──► │  Playwright  │ ──► │  Webshare   │ ──► │  ANVISA  │
│  (Node.js)  │     │   (Stealth)  │     │   (Proxy)   │     │          │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
```

1. **Playwright** launches headless Chromium with stealth mode
2. **Webshare proxy** routes traffic through residential IPs (bypasses blocks)
3. **Angular injection** interacts with ANVISA's frontend
4. **PDF extraction** gets the actual document URL or downloads directly

---

## Setup Webshare Proxy

### 1. Sign Up for Webshare

Go to [webshare.io](https://www.webshare.io/) and create an account.

### 2. Get Your Proxy Credentials

- **Free tier**: 2 proxies, 10GB/month
- **Paid**: Starting at $2.99/month for more proxies

You'll get:
- **Username**: Your account username
- **Password**: A proxy password (different from login)
- **Proxy URL**: e.g., `proxy.webshare.io:10000`

### 3. Configure Environment

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with your Webshare credentials
WEBSHARE_PROXY_URL=http://your-username:your-password@proxy.webshare.io:10000
```

Or use separate variables:
```env
WEBSHARE_USERNAME=your-username
WEBSHARE_PASSWORD=your-password
WEBSHARE_PROXY_URL=proxy.webshare.io:10000
```

---

## API Endpoints

### 1. Search Medications

```bash
GET /api/buscar?q=paracetamol
```

**Response:**
```json
{
  "drugName": "paracetamol",
  "resultsCount": 3,
  "results": [
    {
      "index": 0,
      "nomeProduto": "PARACETAMOL",
      "expediente": "2023001",
      "razaoSocial": "Laboratório X",
      "numRegistro": "12345",
      "situacao": "Ativo",
      "temBulaPaciente": true,
      "temBulaProfissional": true,
      "pdfUrlPaciente": "/api/medication/paracetamol?index=0&tipo=paciente",
      "pdfUrlProfissional": "/api/medication/paracetamol?index=0&tipo=profissional"
    }
  ]
}
```

---

### 2. Get PDF URL

```bash
GET /api/medication/:drugName?index=0&tipo=paciente
```

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

### 3. Download PDF Directly

```bash
GET /api/pdf/download?drug=paracetamol&tipo=paciente
```

**Response:** Binary PDF file (download)

---

### 4. Stream PDF (Proxy)

```bash
GET /api/pdf?url=https://consultas.anvisa.gov.br/api-bula/...
```

**Response:** PDF streamed inline (for iframe viewer)

---

## Usage Examples

### JavaScript (Frontend)

```javascript
// Search for medication
async function searchDrug(drugName) {
  const res = await fetch(`/api/buscar?q=${encodeURIComponent(drugName)}`);
  const data = await res.json();
  return data.results;
}

// Open PDF viewer
function openBula(result, drugName) {
  const pdfUrl = `/api/pdf?url=${encodeURIComponent(result.pdfUrlPaciente)}`;
  window.open(pdfUrl, '_blank');
}

// Download PDF
function downloadBula(drugName, index = 0) {
  window.location.href = `/api/pdf/download?drug=${encodeURIComponent(drugName)}&index=${index}`;
}
```

### cURL

```bash
# Search
curl "http://localhost:8080/api/buscar?q=paracetamol"

# Get PDF URL
curl "http://localhost:8080/api/medication/paracetamol?index=0&tipo=paciente"

# Download
curl -o bula.pdf "http://localhost:8080/api/pdf/download?drug=paracetamol&tipo=paciente"
```

---

## Without Proxy (Not Recommended)

The scraper works without a proxy, but ANVISA may block requests:

```env
# No proxy configured - may get rate limited
# WEBSHARE_PROXY_URL=
```

You'll see this warning in logs:
```
[ANVISA] No proxy configured. Set WEBSHARE_PROXY_URL for better success rate.
```

---

## Troubleshooting

### "Nenhum resultado encontrado"

- ANVISA may be temporarily blocking your IP
- Try with a different proxy location
- Wait a few minutes and retry

### "Bula paciente não disponível"

- Some medications only have professional bulas
- Try `tipo=profissional` instead

### Timeout Errors

- ANVISA is slow to respond
- Increase timeout in `lib/anvisa-scraper.js`
- Check proxy connection

### Proxy Authentication Failed

- Verify username/password in `.env`
- Check proxy URL format: `http://user:pass@host:port`
- Test proxy in browser first

---

## Testing Locally

```bash
# Install dependencies
npm install

# Set up .env with Webshare credentials
cp .env.example .env
# Edit .env...

# Start server
npm run dev

# Test search
curl "http://localhost:8080/api/buscar?q=dipirona"
```

---

## Deploy to Fly.io

```bash
# Set Webshare proxy as secret
fly secrets set WEBSHARE_PROXY_URL="http://user:pass@proxy.webshare.io:10000"

# Deploy
fly deploy
```

---

## Architecture

### `lib/anvisa-scraper.js`

Main scraper module with 3 functions:

1. **`searchBula(drug)`** - Search ANVISA, return list of results
2. **`getPdfUrl(drug, index, tipo)`** - Get direct PDF URL
3. **`downloadBulaPdf(drug, index, tipo)`** - Download PDF buffer

### Key Features

- ✅ **Stealth mode** - puppeteer-extra-plugin-stealth
- ✅ **Proxy support** - Webshare residential proxies
- ✅ **Angular injection** - Interacts with ANVISA's frontend
- ✅ **Error handling** - Graceful failures with meaningful messages
- ✅ **No caching** - Fresh data every time (can add Redis if needed)

---

## Comparison with Python Version

Your Python repo (`files (3)`) uses:
- `playwright` + `playwright_stealth`
- Same Angular injection technique
- Same DOM selectors

This Node.js version:
- Uses `playwright` + `puppeteer-extra-plugin-stealth`
- Same approach, different language
- Integrated with Express.js server

---

## Next Steps

1. **Test locally** with your Webshare account
2. **Deploy to Fly.io** with proxy secrets
3. **Integrate with chat** - auto-fetch PDFs when user asks about meds
4. **Add caching** - Redis for frequently accessed bulas

---

**Happy scraping! 🕷️**
