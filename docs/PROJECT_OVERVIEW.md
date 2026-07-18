# Expenso – Project Overview Documentation

---

## 📖 Table of Contents
1. [API Overview](#api-overview)
2. [Client‑Side Functions](#client-side-functions)
3. [Database Interaction (Supabase)](#database-interaction-supabase)
4. [WebSocket Real‑Time Layer](#websocket-real-time-layer)
5. [Why No Express API?](#why-no-express-api)
6. [Data Flow Diagram](#data-flow-diagram)
7. [Additional Resources](#additional-resources)

---

## API Overview
The project deliberately keeps the backend surface minimal. The only server‑side endpoint is a **Vercel Serverless Function** located at `api/news.js`.

```ts
// api/news.js
export default async function handler(req, res) {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return res.status(500).json({ error: "GNEWS_API_KEY not set" });

  try {
    const upstream = await fetch(
      `https://gnews.io/api/v4/top-headlines?category=business&lang=en&country=us&max=9&apikey=${key}`
    );
    const data = await upstream.json();
    res.setHeader("Cache‑Control", "s‑maxage=3600, stale‑while‑revalidate");
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

*Purpose*: Proxy the third‑party **GNews** API to keep the API key secret, and add a cache‑control header for CDN caching.

> **Note** – All other data operations (expenses, income, jars, chats, etc.) are performed directly against **Supabase** from the client – no additional REST endpoints are required.

---

## Client‑Side Functions
Below is a curated list of the most important functions that touch the data layer. They are spread across the `src/pages` directory and the helper library `src/lib`.

### 1. Data Fetching in Pages
| File | Function | Description |
|------|----------|-------------|
| `src/pages/Social.tsx` | `fetchUser` | Retrieves the current user profile from Supabase Auth and stores it in local state. |
| `src/pages/Social.tsx` | `fetchGameSuggestions` | Calls an external **OpenRouter** model (via a custom wrapper) to generate game‑recommendation content. |
| `src/pages/Social.tsx` | `fetchLeaderboard` | Pulls leaderboard data from Supabase `leaderboard` table. |
| `src/pages/Social.tsx` | `fetchChallenges` | Retrieves challenge data; optionally receives the current user to personalize results. |
| `src/pages/Social.tsx` | `fetchChatStats` | Aggregates chat statistics for a given user ID. |
| `src/pages/Reports.tsx` | `fetchData` | Loads reporting data (expenses, income) from Supabase using RPC calls. |
| `src/pages/ReceiptScanner.tsx` | `fetchReceipts` | Reads receipt records belonging to the signed‑in user from Supabase. |
| `src/pages/MarketNews.tsx` | `fetchNews` | Calls the serverless `/api/news` endpoint defined above. |
| `src/pages/JarSystem.tsx` | `fetchJars` / `fetchAvailableMoney` | Loads jar information and available cash balance from Supabase tables. |

### 2. Supabase Helper (`src/lib/supabase.ts`)
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```
*Exports a pre‑configured Supabase client used throughout the app.*

### 3. WebSocket Manager (`src/lib/websocket.ts`)
Key public methods:
- `joinRoom(roomId)` – subscribes the user to a chat room.
- `leaveRoom(roomId)` – unsubscribes.
- `sendMessage(roomId, content, replyTo?)` – sends a chat message.
- `sendTyping(roomId, isTyping)` – notifies others that the user is typing.
- `updateStatus(isOnline, statusMessage?)` – broadcasts presence.
- `disconnect()` – gracefully closes the socket.

All methods rely on an authenticated Supabase session token passed as a query‑string parameter to the WebSocket endpoint (`wss://expo‑backend-0kn5.onrender.com`).

---

## Database Interaction (Supabase)
The project treats Supabase as **the source of truth**. The workflow is:
1. **Auth** – Clerk (or Supabase Auth) provides a JWT that the client stores via the Supabase SDK.
2. **CRUD** – Front‑end components call `supabase.from('<table>').select()/insert()/update()/delete()` directly.
3. **Realtime** – Supabase Realtime streams are *not* used; instead a custom WebSocket server relays chat‑related events for finer‑grained control.
4. **Serverless Functions** – Only the news proxy lives in `api/`; any heavy lifting (e.g., OpenRouter calls) is performed client‑side or via separate serverless services.

> **Why this works** – Supabase handles connection pooling, row‑level security, and edge caching, allowing the front‑end to act like a thin client without a traditional backend.

---

## WebSocket Real‑Time Layer
The `WebSocketManager` class (see `src/lib/websocket.ts`) encapsulates the real‑time protocol:
- **Connection** – Established after a successful Supabase auth session.
- **Token‑Based Authentication** – The JWT is appended to the WebSocket URL (`?token=…`).
- **Message Routing** – Incoming messages are parsed and emitted via a simple `EventEmitter`‑style API (`on(event, handler)`).
- **Reconnect Logic** – Exponential back‑off with a maximum of five attempts.
- **Usage** – UI components subscribe to events like `new_message`, `typing`, `presence_update` to instantly reflect changes.

---

## Why No Express API?
> **Design Decision** – The project intentionally avoids an Express (or any custom Node/Express) server for several reasons:
1. **Serverless‑First** – Vercel / Netlify serverless functions cost less and scale automatically. The only needed function is the news proxy.
2. **Supabase Direct SDK** – Supabase gives a fully‑featured client library (auth, storage, Postgres) that removes the need for a custom REST layer.
3. **Reduced Ops Overhead** – No deployment pipeline for a separate API service; everything lives in the same repo and is deployed together.
4. **Security** – Sensitive keys (e.g., GNews API key) stay on the serverless edge, while user‑data stays behind Supabase Row‑Level Security (RLS) policies.
5. **Developer Experience** – Front‑end developers can work with a single stack (React + Supabase) without context‑switching to a backend language.

If a future feature requires complex business logic that cannot be expressed with Supabase RPCs, a new serverless function can be added without spinning up an entire Express app.

---

## Data Flow Diagram
<img width="2340" height="1056" alt="mermaid-diagram (1)" src="https://github.com/user-attachments/assets/a5530a97-534a-42cb-a33c-d5cda940e17d" />


---

## Additional Resources
- **Supabase Docs** – https://supabase.com/docs
- **Clerk Docs** – https://clerk.dev/docs
- **OpenRouter Model** – meta‑llama/llama‑3.3‑70b‑instruct (used for game suggestions)
- **Vercel Serverless Functions** – https://vercel.com/docs/concepts/functions/serverless-functions
- **WebSocket Server Repo** – `https://github.com/spide/expo-backend-0kn5`

---

*This document was generated to provide a holistic view of the Expenso codebase, its data handling mechanisms, and the architectural rationale behind the serverless approach.*
