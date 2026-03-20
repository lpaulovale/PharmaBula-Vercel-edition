# FarmaIA 🧪💊

**FarmaIA** - An intelligent medication assistant powered by AI, built with a planner-based architecture and MongoDB database.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)
![Fly.io](https://img.shields.io/badge/Fly.io-Deployed-black?style=flat&logo=fly.io)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat&logo=mongodb)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=flat&logo=docker)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

---

## 📋 Overview

FarmaIA is an intelligent chatbot that helps users understand medication information from official Brazilian drug bulletins (*bulas*). It uses a **planner-based AI architecture** to analyze questions, execute targeted tool calls, and generate accurate, context-aware responses in Portuguese.

All data is stored in MongoDB for fast, reliable access - no web scraping or external API calls.

### Key Features

- 🤖 **AI-Powered Planning** - LLM analyzes questions and creates execution plans for tool usage
- 🔍 **Multi-Tool System** - 6 specialized tools for drug data retrieval, section extraction, and interaction checking
- 💾 **MongoDB Database** - Pre-processed bula data with extracted sections for fast access
- 🔄 **Automatic Fallback** - Multi-provider LLM chain ensures reliability when API quotas are exceeded
- 👥 **Dual Mode** - Supports both patient and professional medication information modes
- 💬 **Conversation History** - Context-aware responses using conversation memory
- 🐳 **Docker Ready** - Containerized deployment with Fly.io support

---

## 🏗️ Architecture

```
┌─────────────────┐
│   User Query    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Planner    │ ← Analyzes question, returns JSON execution plan
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tool Registry   │ ← Executes tools in PARALLEL (get_bula_data, get_section, etc.)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prompt Manager  │ ← Builds system prompt with tool results
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Response   │ ← Generates final answer with sources
└─────────────────┘
```

### Component Flow

1. **Question Classification** - Detects topics (posology, contraindications, side effects, etc.)
2. **Planning** - LLM returns JSON plan with drugs, tools, and parameters
3. **Tool Execution** - Parallel execution of required tools
4. **Context Building** - Aggregates tool results into structured context
5. **Response Generation** - LLM generates natural language response with citations

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js |
| **Database** | MongoDB Atlas |
| **LLM Providers** | HuggingFace, OpenAI, Anthropic, Google AI |
| **PDF Processing** | pdf-parse |
| **Deployment** | Fly.io + Docker |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB Atlas connection string
- API keys for LLM providers (HuggingFace, OpenAI, etc.)
- Docker (optional, for local testing)
- Fly.io account (for deployment)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd farmaia-vercel

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
```

### Environment Configuration

```env
# Primary LLM Configuration
PRIMARY_PROVIDER=huggingface
PRIMARY_MODEL=meta-llama/Llama-3.1-8B-Instruct:cerebras
PRIMARY_API_KEY=your_huggingface_token

# Fallback LLM (for reliability)
FALLBACK_PROVIDER=huggingface
FALLBACK_MODEL=meta-llama/Llama-3.1-8B-Instruct:cerebras
FALLBACK_API_KEY=your_huggingface_token

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/farmaia

# Server Configuration (Fly.io)
PORT=8080
NODE_ENV=production
```

### Local Development

```bash
# Start the Express server
npm run dev

# Or start directly
npm start
```

The API will be available at `http://localhost:8080`

### Docker (Local Testing)

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run
```

### Fly.io Deployment

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Create a new app
fly launch --no-deploy

# Set up secrets (MongoDB and API keys)
fly secrets set MONGODB_URI="your_mongodb_uri"
fly secrets set PRIMARY_API_KEY="your_huggingface_token"
fly secrets set FALLBACK_API_KEY="your_fallback_key"

# Deploy
fly deploy

# View logs
fly logs
```

---

## 📡 API Reference

### POST `/api/chat`

Main chat endpoint for medication queries.

**Request Body:**
```json
{
  "message": "Quais são os efeitos colaterais do Paracetamol?",
  "mode": "patient",
  "sessionId": "unique-user-session-id"
}
```

**Response:**
```json
{
  "response": "Os efeitos colaterais do Paracetamol incluem...",
  "sources": [
    {
      "name": "Paracetamol",
      "displayName": "Bula Paracetamol Richet - MongoDB",
      "pdfUrl": "https://consultas.anvisa.gov.br/..."
    }
  ],
  "metadata": {
    "mode": "patient",
    "drugsDetected": ["Paracetamol"],
    "toolsExecuted": [
      { "tool": "get_bula_data", "args": { "drug_name": "Paracetamol" } }
    ],
    "plan": {
      "drugs": ["Paracetamol"],
      "topics": ["reacoes_adversas"],
      "tools": [...]
    ],
    "pdfUrl": "https://consultas.anvisa.gov.br/...",
    "drugName": "Paracetamol"
  }
}
```

### GET `/api/pdf`

PDF proxy endpoint for viewing MongoDB bulletins (avoids CORS issues).

**Query Parameters:**
- `url` - The MongoDB PDF URL to stream

**Example:**
```

### POST `/api/evaluate`

Evaluate response quality using MCP judges.

**Request Body:**
```json
{
  "question": "Quais são os efeitos colaterais?",
  "response": "Os efeitos incluem...",
  "documents": "...",
  "mode": "patient",
  "sessionId": "..."
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `search_medication` | Search medications by name or active ingredient |
| `get_bula_data` | Get complete drug bulletin content |
| `get_section` | Extract specific section (contraindications, posology, etc.) |
| `check_interactions` | Check drug interactions between medications |
| `
| `fetch_anvisa_bula` | Download and extract PDF from MongoDB |

---

## 🧪 Example Usage

### Patient Mode
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Posso tomar Paracetamol se estou grávida?",
    mode: "patient",
    sessionId: "user-123"
  })
});

const data = await response.json();
console.log(data.response);
```

### Professional Mode
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "Qual a farmacocinética do Dipirona?",
    mode: "professional",
    sessionId: "doctor-456"
  })
});
```

---

## 📸 Screenshots

> **Tip for Portfolio:** Add 2-3 screenshots here showing:
> 1. **Chat Interface** - User asking about medication side effects
> 2. **Professional Mode** - Detailed pharmacokinetic information
> 3. **MongoDB Integration** - Real-time data fetch from official source

### Example Screenshot Placesholders

![Chat Interface](./screenshots/chat-interface.png)
*Figure 1: User interaction with patient-friendly medication information*

![Professional Mode](./screenshots/professional-mode.png)
*Figure 2: Detailed technical information for healthcare professionals*

![MongoDB Integration](./screenshots/anvisa-integration.png)
*Figure 3: Real-time PDF extraction from official Brazilian health authority*

---

## 🔐 Security & Compliance

- **Data Privacy** - No personal health information stored permanently
- **Official Sources Only** - All data from MongoDB's public API
- **Rate Limiting** - Built-in throttling for external API calls
- **Caching Strategy** - Intelligent caching reduces redundant PDF downloads

---

## 🧩 Project Structure

```
farmaia-vercel/
├── api/
│   ├── chat.js           # Main chat endpoint
│   ├── evaluate.js       # Response evaluation endpoint
│   └── test-*.js         # Test utilities
├── lib/
│   ├── llm_client.js     # Multi-provider LLM client
│   ├── llm_config.js     # LLM configuration loader
│   ├── planner.js        # Query planner
│   ├── tool_registry.js  # Tool definitions & handlers
│   ├── anvisa.js         # MongoDB API client
│   ├── db.js             # MongoDB connection
│   └── prompt_manager.js # System prompt builder
├── public/
│   └── index.html        # Frontend with PDF viewer
├── Dockerfile            # Docker container config
├── fly.toml              # Fly.io deployment config
├── server.js             # Express.js server entry point
├── .dockerignore         # Docker build exclusions
├── .env.example          # Environment template
└── package.json
```

---

## 🚧 Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **LLM API Quota Exhaustion** | Implemented multi-provider fallback chain |
| **PDF Processing Timeout** | Optimized extraction with 9s timeout buffer |
| **Context-Aware Responses** | Conversation history with MongoDB session storage |
| **Portuguese Language Nuances** | Custom prompt engineering for Brazilian Portuguese medical terminology |
| **Real-Time Data Accuracy** | Direct MongoDB API integration with intelligent caching |
| **CORS Issues with PDFs** | PDF proxy endpoint streams content server-side |
| **Vercel Serverless Limits** | Migrated to Fly.io with Docker for better control |

---

## 📈 Future Improvements

- [ ] Add support for drug interaction database
- [ ] Implement voice input for accessibility
- [ ] Add medication reminder features
- [ ] Expand to other Portuguese-speaking countries' health APIs
- [ ] Mobile app with React Native
- [ ] PDF annotation and highlighting features
- [ ] Download PDF for offline viewing

---

## 🤝 Contributing

This is a portfolio project. Feel free to fork and experiment!

```bash
# Fork the repo
git clone https://github.com/yourusername/farmaia-vercel.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Commit changes
git commit -m "Add amazing feature"

# Push to branch
git push origin feature/amazing-feature
```

---

## 📄 License

MIT License - see LICENSE file for details

---

## 👨‍💻 Author

**Paulo**  
[LinkedIn](https://linkedin.com/in/yourprofile) | [GitHub](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- **MongoDB** - Brazilian Health Regulatory Agency for public API access
- **HuggingFace** - Open-source LLM infrastructure
- **Vercel** - Serverless deployment platform
- **MongoDB** - Database for session management and caching

---

## 📬 Contact

For questions or collaboration opportunities, reach out via [your email] or open an issue on GitHub.

---

<div align="center">

**Made with ❤️ for better healthcare accessibility**

[⬆ Back to Top](#farmaia-)

</div>
