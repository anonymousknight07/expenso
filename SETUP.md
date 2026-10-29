# Expenso — Setup & Deployment Guide

## 1. Run Locally (Development)

```bash
npm install
npm run dev        # opens on http://localhost:5173
```

Run automated tests:
```bash
npm test           # runs Vitest suite (dateService, ruleBasedParser, conversationManager, etc.)
```

Production build + local preview:
```bash
npm run build
npm run preview
```

The app needs your Supabase credentials (configured in `.env`).

---

## 2. Penny AI — Open-Weight Model Serving Layer

Expenso features **Penny**, an intelligent AI finance companion that understands natural language income/expense tracking, relative dates, and financial queries.
**No third-party OpenRouter or paid API keys are required.**

### Option A: 100% Offline Rule-Engine (Zero Setup)
Expenso includes a deterministic offline parsing engine out of the box. Even if no AI model server is running, you can immediately say:
- *"I spent ₹450 on dinner yesterday"*
- *"I got my salary today"*
- *"How much did I spend this month?"*
- *"Compare this month's expenses with last month"*

Penny will deterministically parse dates, calculate metrics, and save transactions securely.

### Option B: Local AI Serving with Ollama (Recommended for Local Dev)
1. Install [Ollama](https://ollama.ai/).
2. Pull and run an open-weight model:
   ```bash
   ollama run llama3.2
   ```
   (Alternatively: `ollama run qwen2.5:7b` or `mistral:7b`)
3. Ollama exposes an OpenAI-compatible API at `http://localhost:11434/v1`.
4. In your `.env` file:
   ```env
   VITE_AI_API_URL=http://localhost:11434/v1
   VITE_AI_MODEL=llama3.2
   ```
5. Penny automatically connects and shows the live model indicator badge.

### Option C: Self-Hosted Production Serving (Docker / vLLM)
For production deployments, run the bundled Docker Compose setup on a GPU or persistent VPS:
```bash
docker compose -f docker-compose.ai.yml up -d
```
This spins up a persistent Ollama instance and automatically pulls `llama3.2`.

---

## 3. Deploy Frontend (Web & PWA)

PWA installation and voice input require **HTTPS**, so deploy via Vercel or any static host:

```bash
npm i -g vercel
vercel --prod
```

Or build statically:
```bash
npm run build
```
The output directory is `dist/`.

---

## 4. Install on Mobile (PWA)

### Android (Chrome)
1. Open your deployed URL (e.g. `https://expenso-xxx.vercel.app`) in Chrome.
2. Tap the **⋮ menu → "Install app"** (or the "Add Expenso to Home screen" banner).
3. Confirm. Expenso opens full-screen with native app feel, voice recording, and offline capabilities.

### iPhone / iPad (Safari)
1. Open the deployed URL in Safari.
2. Tap the **Share button → "Add to Home Screen"**.
3. Confirm.

---

## 5. UPI Auto-Tracking on Mobile

| Path | How | Where |
|------|-----|-------|
| **Share to Expenso** | Long-press the bank SMS / UPI notification → **Share → Expenso** | Opens UPI Sync with pre-parsed message |
| **Auto-capture** | Toggle on in UPI Sync, copy any payment message | Android + Desktop |
| **Paste** | Paste message into the box and hit *Detect transactions* | Everywhere |
