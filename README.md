# PharmaBula AI 🧪💊

**BulaIA** - An intelligent medication assistant powered by AI, built with a planner-based architecture and real-time ANVISA integration.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat&logo=node.js)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=flat&logo=vercel)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat&logo=mongodb)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

---

## 📋 Overview

PharmaBula AI is an intelligent chatbot that helps users understand medication information from official Brazilian ANVISA drug bulletins (*bulas*). It uses a **planner-based AI architecture** to analyze questions, execute targeted tool calls, and generate accurate, context-aware responses in Portuguese.

### Key Features

- 🤖 **AI-Powered Planning** - LLM analyzes questions and creates execution plans for tool usage
- 🔍 **Multi-Tool System** - 6 specialized tools for drug data retrieval, section extraction, and interaction checking
- 📦 **Real-Time ANVISA Integration** - Fetches official drug bulletins directly from Brazil's health regulatory agency
- 💾 **Intelligent Caching** - MongoDB caching for PDF extractions to optimize performance
- 🔄 **Automatic Fallback** - Multi-provider LLM chain ensures reliability when API quotas are exceeded
- 👥 **Dual Mode** - Supports both patient and professional medication information modes
- 💬 **Conversation History** - Context-aware responses using conversation memory

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
| **Framework** | Express.js (Vercel Serverless) |
| **Database** | MongoDB Atlas |
| **LLM Providers** | HuggingFace, OpenAI, Anthropic, Google AI |
| **External API** | ANVISA Bulário Eletrônico |
| **PDF Processing** | pdf-parse |
| **Deployment** | Vercel |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- MongoDB Atlas connection string
- API keys for LLM providers (HuggingFace, OpenAI, etc.)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd pharmabula-vercel

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
FALLBACK_PROVIDER=openai
FALLBACK_MODEL=gpt-3.5-turbo
FALLBACK_API_KEY=your_openai_key

# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/pharmabula
```

### Local Development

```bash
# Run development server (Vercel CLI)
npm run dev

# Or start directly
npm start
```

The API will be available at `http://localhost:3000/api/chat`

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
    "Bula Paracetamol Richet - ANVISA"
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
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `search_medication` | Search medications by name or active ingredient |
| `get_bula_data` | Get complete drug bulletin content |
| `get_section` | Extract specific section (contraindications, posology, etc.) |
| `check_interactions` | Check drug interactions between medications |
| `find_generic_versions` | Find all registered versions (generics, brand names) |
| `fetch_anvisa_bula` | Download and extract PDF from ANVISA |

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
> 3. **ANVISA Integration** - Real-time data fetch from official source

### Example Screenshot Placesholders

![Chat Interface](./screenshots/chat-interface.png)
*Figure 1: User interaction with patient-friendly medication information*

![Professional Mode](./screenshots/professional-mode.png)
*Figure 2: Detailed technical information for healthcare professionals*

![ANVISA Integration](./screenshots/anvisa-integration.png)
*Figure 3: Real-time PDF extraction from official Brazilian health authority*

---

## 🔐 Security & Compliance

- **Data Privacy** - No personal health information stored permanently
- **Official Sources Only** - All data from ANVISA's public API
- **Rate Limiting** - Built-in throttling for external API calls
- **Caching Strategy** - Intelligent caching reduces redundant PDF downloads

---

## 🧩 Project Structure

```
pharmabula-vercel/
├── api/
│   ├── chat.js           # Main chat endpoint
│   ├── evaluate.js       # Response evaluation endpoint
│   └── test-*.js         # Test utilities
├── lib/
│   ├── llm_client.js     # Multi-provider LLM client
│   ├── llm_config.js     # LLM configuration loader
│   ├── planner.js        # Query planner
│   ├── tool_registry.js  # Tool definitions & handlers
│   ├── anvisa.js         # ANVISA API client
│   ├── db.js             # MongoDB connection
│   └── prompt_manager.js # System prompt builder
├── public/
│   └── index.html        # Frontend (if applicable)
├── .env.example          # Environment template
├── vercel.json           # Vercel configuration
└── package.json
```

---

## 🚧 Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **LLM API Quota Exhaustion** | Implemented multi-provider fallback chain |
| **PDF Processing Timeout** | Optimized extraction with 9s timeout buffer for Vercel 10s limit |
| **Context-Aware Responses** | Conversation history with MongoDB session storage |
| **Portuguese Language Nuances** | Custom prompt engineering for Brazilian Portuguese medical terminology |
| **Real-Time Data Accuracy** | Direct ANVISA API integration with intelligent caching |

---

## 📈 Future Improvements

- [ ] Add support for drug interaction database
- [ ] Implement voice input for accessibility
- [ ] Add medication reminder features
- [ ] Expand to other Portuguese-speaking countries' health APIs
- [ ] Mobile app with React Native

---

## 🤝 Contributing

This is a portfolio project. Feel free to fork and experiment!

```bash
# Fork the repo
git clone https://github.com/yourusername/pharmabula-vercel.git

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

- **ANVISA** - Brazilian Health Regulatory Agency for public API access
- **HuggingFace** - Open-source LLM infrastructure
- **Vercel** - Serverless deployment platform
- **MongoDB** - Database for session management and caching

---

## 📬 Contact

For questions or collaboration opportunities, reach out via [your email] or open an issue on GitHub.

---

<div align="center">

**Made with ❤️ for better healthcare accessibility**

[⬆ Back to Top](#pharmabula-ai-)

</div>
