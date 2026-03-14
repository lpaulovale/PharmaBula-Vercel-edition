# Quick Setup - Simplified LLM Config

## Required Environment Variables

```bash
# MongoDB (REQUIRED)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0

# LLM Primary (REQUIRED)
PRIMARY_PROVIDER=huggingface
PRIMARY_MODEL=meta-llama/Llama-3.1-8B-Instruct:cerebras
PRIMARY_API_KEY=hf_your_valid_token

# LLM Fallback (OPTIONAL but recommended)
FALLBACK_PROVIDER=huggingface
FALLBACK_MODEL=Qwen/Qwen2.5-72B-Instruct
FALLBACK_API_KEY=hf_your_valid_token
```

## That's It!

- **Planner** → Uses PRIMARY
- **Response Generator** → Uses PRIMARY (falls back to FALLBACK)
- **Judges** → Uses PRIMARY (falls back to FALLBACK)

No need for separate `JUDGE_*` variables!

## Getting HuggingFace Token

1. Go to https://huggingface.co/settings/tokens
2. Create a new token (read access is enough)
3. Copy the token (starts with `hf_`)
4. Add to `.env` or Vercel

## Vercel Setup

```bash
# Add environment variables
vercel env add MONGODB_URI
vercel env add PRIMARY_API_KEY
vercel env add FALLBACK_API_KEY  # optional

# Deploy
vercel --prod
```

## Testing

```bash
# Local test
export MONGODB_URI="mongodb+srv://..."
export PRIMARY_API_KEY="hf_..."
npm run dev

# Test query
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Quais efeitos colaterais do paracetamol?", "mode": "patient"}'
```

## Troubleshooting

### 402 Error (Out of Credits)
- HuggingFace free tier has monthly limits
- Solution: Get new token or use different model

### 401 Error (Invalid Token)
- Token is expired or wrong
- Solution: Generate new token at huggingface.co/settings/tokens

### No LLM Models Configured
- Check PRIMARY_API_KEY is set
- Make sure token doesn't have "your_..._here" placeholder
