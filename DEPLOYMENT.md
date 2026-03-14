# 🚀 Fly.io Deployment Guide

## Quick Deploy (2 secrets only)

```bash
# 1. Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Create app
fly launch --no-deploy

# 4. Set ONLY 2 secrets:
fly secrets set MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/pharmabula"
fly secrets set PRIMARY_API_KEY="hf_xxxxxxxxxxxxxxxxxxxxx"

# 5. Deploy!
fly deploy
```

---

## Step-by-Step

### 1. Install Fly.io CLI

**Linux/macOS:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

---

### 2. Login

```bash
fly auth login
```

Opens browser for authentication.

---

### 3. Create App

```bash
fly launch --no-deploy
```

- Select region: `gru` (São Paulo)
- App name: `pharmabula-ai` (or auto-generated)

---

### 4. Set Secrets

**Required (2):**

```bash
# MongoDB Database
fly secrets set MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/pharmabula"

# HuggingFace API Key
fly secrets set PRIMARY_API_KEY="hf_xxxxxxxxxxxxxxxxxxxxx"
```

**Optional:**

```bash
# Fallback LLM
fly secrets set FALLBACK_API_KEY="hf_xxxxxxxxxxxxxxxxxxxxx"

# OpenAI (if using GPT)
fly secrets set OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxxxxxxx"
```

---

### 5. Deploy

```bash
fly deploy
```

---

### 6. Access Your App

```bash
# Open in browser
fly open

# Or get URL
fly apps info

# View logs
fly logs
```

---

## Environment Variables Summary

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | ✅ | Database |
| `PRIMARY_API_KEY` | ✅ | HuggingFace LLM |
| `FALLBACK_API_KEY` | ❌ | Backup LLM |
| `OPENAI_API_KEY` | ❌ | Use GPT |
| `ANTHROPIC_API_KEY` | ❌ | Use Claude |

---

## Troubleshooting

### App won't start
```bash
fly logs
```

### Rebuild without cache
```bash
fly deploy --no-cache
```

### Update secrets
```bash
fly secrets set NEW_VALUE="..."
# App restarts automatically
```

### SSH into machine
```bash
fly ssh console
```

---

## Cost

**Free tier covers:**
- Up to 3 shared-cpu-1x VMs (256MB RAM each)
- 3GB storage
- 160GB outbound transfer

**Estimated:** Free for light usage, ~$5-10/month for moderate.

---

**Done! 🎉**
