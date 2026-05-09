![logo](https://github.com/user-attachments/assets/12751753-c071-41b6-9423-2116abfa024d)

#  Expenso - Smart Expense Tracker

**Expenso** is a powerful and intelligent expense tracker designed to help you take control of your finances. From budgeting to visual analytics, goal-based savings to anti-impulse journaling, Expenso is your all-in-one financial companion.

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

###  AI Chatbot (Penny)
- Financial Advisor Chatbot
- Suggested Questions Based on Auth Status
- Basic Q&A for Non-Logged-In Users
- Full Financial Advisory for Authenticated Users

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

---

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GNEWS_API_KEY=your_gnews_api_key  # optional, for Market News
   ```
3. Run `npm install`
4. Run `npm run dev` to start the development server

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


