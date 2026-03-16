# MongoDB Setup for BulaIA MCP Server

## Overview

This server now uses **MongoDB** for bula data instead of PDF downloads. The data is pre-processed with sections already extracted for fast access.

## Data Source

- **1,564 documents** total
- **1,526 bulas** (medicine leaflets)
- **38 artigos** (health articles)

### Available Sections (with coverage)

| Section | Coverage | Description |
|---------|----------|-------------|
| `posologia` | 98% | Dosage/usage instructions |
| `indicacao` | 97.8% | Medical indications |
| `contraindicacao` | 94.4% | Contraindications |
| `apresentacao` | 96% | Packaging/presentation |
| `reacoes` | 91.6% | Adverse reactions |
| `advertencias` | 91.9% | Warnings/precautions |
| `superdosagem` | 84.4% | Overdose information |
| `mecanismo` | 62.7% | Mechanism of action |
| `armazenamento` | 35.5% | Storage instructions |

## Setup

### 1. Environment Variable

Set your MongoDB connection string:

```bash
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0"
```

Or create a `.env` file:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Import Data (if needed)

The data is already imported. If you need to re-import:

```bash
# From the data directory
python3 import_mongodb.py
```

## Available Tools

### search_medication
Search medications by name or active ingredient.

```javascript
{
  "name": "search_medication",
  "arguments": {
    "query": "Reumon",
    "bula_type": "paciente"
  }
}
```

### get_bula_data
Get complete bula content for a medication.

```javascript
{
  "name": "get_bula_data",
  "arguments": {
    "drug_name": "Hidantal",
    "mode": "patient"
  }
}
```

### get_section
Get a specific section from a bula.

```javascript
{
  "name": "get_section",
  "arguments": {
    "drug_name": "Reumon Gel",
    "section": "contraindicacao",
    "mode": "patient"
  }
}
```

### get_contraindicacoes
Get contraindications for a medication.

```javascript
{
  "name": "get_contraindicacoes",
  "arguments": {
    "drug_name": "Hidantal"
  }
}
```

### get_posologia
Get dosage information.

```javascript
{
  "name": "get_posologia",
  "arguments": {
    "drug_name": "Dipirona"
  }
}
```

### get_indicacao
Get medical indications.

```javascript
{
  "name": "get_indicacao",
  "arguments": {
    "drug_name": "Paracetamol"
  }
}
```

### search_by_ingredient
Search by active ingredient.

```javascript
{
  "name": "search_by_ingredient",
  "arguments": {
    "ingredient": "diclofenaco"
  }
}
```

### search_text
Full-text search across all bulas.

```javascript
{
  "name": "search_text",
  "arguments": {
    "term": "dor de cabeça"
  }
}
```

### check_interactions
Check drug interactions.

```javascript
{
  "name": "check_interactions",
  "arguments": {
    "drugs": ["Hidantal", "Paracetamol"],
    "mode": "patient"
  }
}
```

## Fallback Behavior

When a section is not explicitly extracted (`has_section[section] = false`), the server automatically searches the full text using keywords. This ensures you still get relevant information even when the structured section is missing.

## Testing

```bash
node test-mongodb.js
```

## Security Note

**Never commit your MongoDB credentials!** Usee environment variables or a `.env` file (which is already in `.gitignore`).
