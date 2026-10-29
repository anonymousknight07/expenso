<img width="1020" height="286" alt="logo-full" src="https://github.com/user-attachments/assets/2a9b4f01-059b-494e-93d5-0219f1262aea" />


#  Expenso - Smart Expense Tracker

**Expenso** is an AI-first personal finance platform powered by **Penny**, your intelligent conversational finance assistant. Just tell Penny what you earned or spent in plain language — no forms, no friction. Penny understands natural language, resolves relative dates, infers categories, and records transactions directly to your account. From budgeting to visual analytics, goal-based savings to detailed reports, Expenso is your all-in-one financial companion.

---

##  Features

###  Authentication
- Email/Password Sign up & Login
- Forgot Password / Password Reset

###  Dashboard
- Monthly Overview: Total Income, Expenses & Balance
- Daily & Weekly Breakdowns
- Visualizations: Pie Charts & Bar Graphs
- Financial Goals (create, edit, delete, track progress)
- “Before You Buy” 48-Hour Wishlist with reflection periods
- Mood Tracker (9 moods, 30-day statistics)
- Avatar System (6 categories: Character, Scene, Heroes, Series, Quotes, Anime)
- Leaderboard (top 10 users by XP)

###  Expense Management
- Add, Edit & Delete Expenses
- Tag Multiple Categories per Expense
- Filter by Categories
- Budget Alerts (warning at threshold, exceeded alerts)
- List View & Calendar View
- Export to Excel & PDF
- Share via WhatsApp & Email

###  Income Management
- Add, Edit & Delete Income
- Categorize Income (Salary, Freelance, Passive, etc.)
- In-Hand Amount vs Gross Amount Tracking
- Leave & Holiday Tracking with Salary Deduction Calculation
- 50+ Festival Greetings (Diwali, Christmas, Eid, etc.)
- Daily Pay & Salary After Leaves Calculation
- Calendar View with Leave Highlighting
- Export to Excel & PDF
- Share via WhatsApp & Email

###  Budgeting
- Set Monthly Budgets per Category
- Set Monthly Overall Budget
- Budget Usage Progress Bars & Warnings
- Customizable Notification Thresholds
- Savings Calculation (Income - Total Budgets)
- Real-time Budget Updates
- Acknowledge/Dismiss Alerts
- Export to Excel & PDF

### Reports & Analytics
- Monthly, 3-Month, 6-Month & 1-Year Views
- Filter by Category & Amount Range
- Line Charts, Bar Charts & Pie Charts
- Income, Expense & Savings Trends
- Export to Excel & PDF

###  Receipt Scanner
- Upload Image or Camera Capture
- OCR Text Extraction (Tesseract.js)
- Receipt Parsing (Store Name, Date, Items, Total)
- Item-by-Item Editing Before Confirmation
- Auto-Create Expense from Confirmed Receipt
- Receipt History with Status Tracking
- Filter by Status (All, Needs Review, Confirmed)

###  Visual Jar System
- Create Savings Jars with Custom Names, Icons & Colors
- 12 Jar Icons (PiggyBank, Coffee, Home, Car, etc.)
- Drag-and-Drop Money Denominations into Jars
- Visual Jar Filling Progress
- Celebration Animation on Jar Completion
- Available Money Calculated from Budget
- Mobile & Desktop Support

###  Market News
- Financial & Business News Feed (GNews API)
- Search News Articles
- 1-Hour Cache with Stale Fallback
- Links to Full Articles

###  Social Features
- Savings & Spending Challenges with XP Rewards
- Challenge Leaderboard & Progress Tracking
- Trivia Games
- Game Suggestions with Upvote/Downvote
- Real-Time Chat Rooms (Public & Private)
- Typing Indicators & Online Status
- Message Replies, Editing & Deletion
- Emoji Picker & Message Search

###  Penny AI Assistant (Primary Experience)
- **Natural language transaction entry** — "I spent ₹450 on dinner yesterday"
- **Conversational multi-turn flows** — Penny asks only for missing information
- **Automatic date resolution** — today, yesterday, last Monday, 3 days ago, etc.
- **Smart category inference** — infers Food & Dining, Groceries, Transport, etc. from descriptions
- **Income & expense tracking** via chat — Salary, Freelance, Side income, and more
- **Financial queries** — "How much did I spend on food last week?", "What's my balance this month?"
- **Inline transaction review** — edit or delete any recorded transaction from the chat
- **Voice input** — speak your transactions using browser-native speech recognition
- **AI model status badge** — shows whether Ollama model is connected or running in deterministic offline mode
- **Works offline** (deterministic fallback) — core transaction recording works even without an AI model

###  AI Chatbot (Penny)
- Financial Advisor Chatbot (floating widget, Supabase Edge Function powered)
- Suggested Questions Based on Auth Status
- Basic Q&A for Non-Logged-In Users
- Full Financial Advisory for Authenticated Users

> **Note:** The full conversational transaction entry experience lives in the **Penny AI Assistant** page (/assistant), which is the default landing screen after login.

---

## Unique Highlights

###  XP & Reward System
- Earn XP for Financial Activities (Login, Goals, Budgets, etc.)
- Level Up (100 XP = 1 Level)
- 5 Achievement Badges (First Transaction, Budget Master, Savings Champion, Perfect Month, Goal Setter)
- Achievement Sharing

###  Multi-Currency Support
- 8 Currencies (USD, EUR, GBP, JPY, INR, CNY, AUD, CAD)
- Currency Selector in Navbar
- Persistent Currency Preference

###  Export Data
- Export Expenses, Income & Budgets as PDF / Excel
- Great for personal reviews or parental audits

---

## Project Structure
```
expense-tracker
├── src
│   ├── components     # Reusable UI (Button, Layout, Chat, etc.)
│   ├── pages          # Dashboard, Expenses, Income, Budget, etc.
│   ├── contexts       # CurrencyContext, ChatContext
│   ├── lib            # Supabase client, WebSocket manager
│   └── App.tsx
├── supabase/functions # Edge functions (chat, scan-receipt)
├── public             # Icons, logos, meta
├── .env.example       # Environment variable template
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

##  Future Development

-  Mobile OTP Login
-  React Native Mobile App (Responsive Web already available)
-  Recurring Transactions (Rent, Subscriptions, etc.)
-  Multi-Device Sync (Web & Mobile)
---

## Built With

- **React.js** (TypeScript)
- **TailwindCSS**
- **Supabase** (Auth, Database, Storage, Edge Functions)
- **Chart.js** + react-chartjs-2 (for graphs)
- **Tesseract.js** (OCR for receipt scanning)
- **React Context API**
- **date-fns** (date utilities)
- **jsPDF** + **xlsx** (PDF & Excel export)
- **lucide-react** (icons)
- **react-hot-toast** (notifications)
- **Vitest** (unit testing — 39 tests)
- **Ollama / vLLM** (optional self-hosted AI model server for Penny)

---

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GNEWS_API_KEY=your_gnews_api_key  # optional, for Market News
   VITE_AI_API_URL=http://localhost:11434/v1  # optional, Ollama for Penny AI
   VITE_AI_MODEL=llama3.2                     # optional, model name
   ```
3. Run `npm install`
4. *(Optional)* Start Ollama for AI-powered Penny: `docker compose -f docker-compose.ai.yml up -d`
5. Run `npm run dev` to start the development server
6. Open [http://localhost:5173](http://localhost:5173) — Penny is the default landing page after login

> Penny works offline in **deterministic mode** even without an Ollama model running.
> Run `npm test` to execute all 39 automated unit tests.

---
## The Workflow 
![Expenso excalidraw](https://github.com/user-attachments/assets/d47000cb-fac3-449e-8bdf-95f354c39a28)


## 📷 Screenshots 

### Homepage
![image](https://github.com/user-attachments/assets/458ac5f4-87ba-472e-a4bb-17c1220732b0)

### Dashboard
![image](https://github.com/user-attachments/assets/3a0f977a-53c8-4922-9db0-27ed4c89403a)

### Expense Screen 
![image](https://github.com/user-attachments/assets/e9e51a79-e845-47de-8826-fc80f86c4eb8)

### Budget Screen
![image](https://github.com/user-attachments/assets/7f53632e-5ae5-4208-9ff2-4159a45db14b)

### Income Screen
![image](https://github.com/user-attachments/assets/4989fe2a-fb6c-4899-9d35-b229979bdac5)

### Reports and Analysis Screen 
![image](https://github.com/user-attachments/assets/090bd973-7991-4869-9cba-a7c388e02c41)



---

## Contributing

Contributions are welcome! Feel free to fork the repo and submit a PR.

---

## License

[MIT License](LICENSE)

---

## Acknowledgements

Thanks to everyone who inspired and contributed ideas for Expenso!  
Built with ❤️ by Akshat Pandey – because money shouldn't be a mystery.


