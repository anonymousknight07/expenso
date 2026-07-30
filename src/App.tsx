import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabase";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Income from "./pages/Income";
import Budget from "./pages/Budget";
import Reports from "./pages/Reports";
// import JarSystem from "./pages/JarSystem";
// import Social from "./pages/Social";
import ExpensoShop from "./pages/ExpensoShop";
import NoSpendTracker from "./pages/NoSpendTracker";
import FinancialTimeMachine from "./pages/FinancialTimeMachine";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Layout from "./components/layout/Layout";
import ReceiptScanner from "./pages/ReceiptScanner";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChatBot from "./components/chat/ChatBot";
import MarketNews from "./pages/MarketNews";
import UpiSync from "./pages/UpiSync";
import Achievements from "./pages/Achievements";

import NotFound from "./pages/NotFound";

// Helper to reduce repetition
const PrivatePage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        try {
          const saved = localStorage.getItem(`expenso_shop_${session.user.id}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.equippedTheme) {
              const themeValue = parsed.equippedTheme.replace("theme_", "");
              if (themeValue === "dark" || !themeValue) {
                document.documentElement.removeAttribute("data-theme");
              } else {
                document.documentElement.setAttribute("data-theme", themeValue);
              }
            }
          }
        } catch (e) {}
      }
    });
  }, []);

  return (
    <CurrencyProvider>
      <Router>
        <Routes>
          {/* ── Public routes ───────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgotPassword" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/terms"
            element={
              <Layout>
                <Terms />
              </Layout>
            }
          />
          <Route
            path="/privacy"
            element={
              <Layout>
                <PrivacyPolicy />
              </Layout>
            }
          />

          {/* ── Protected routes ────────────────────── */}
          <Route
            path="/"
            element={
              <Layout>
                <Home />
              </Layout>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PrivatePage>
                <Dashboard />
              </PrivatePage>
            }
          />
          <Route
            path="/expenses"
            element={
              <PrivatePage>
                <Expenses />
              </PrivatePage>
            }
          />
          <Route
            path="/income"
            element={
              <PrivatePage>
                <Income />
              </PrivatePage>
            }
          />
          <Route
            path="/budget"
            element={
              <PrivatePage>
                <Budget />
              </PrivatePage>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivatePage>
                <Reports />
              </PrivatePage>
            }
          />
          {/* <Route
            path="/jar-system"
            element={
              <PrivatePage>
                <JarSystem />
              </PrivatePage>
            }
          /> */}
          <Route
            path="/shop"
            element={
              <PrivatePage>
                <ExpensoShop />
              </PrivatePage>
            }
          />
          <Route
            path="/no-spend"
            element={
              <PrivatePage>
                <NoSpendTracker />
              </PrivatePage>
            }
          />
          <Route
            path="/time-machine"
            element={
              <PrivatePage>
                <FinancialTimeMachine />
              </PrivatePage>
            }
          />
          <Route
            path="/market"
            element={
              <PrivatePage>
                <MarketNews />
              </PrivatePage>
            }
          />
          {/* <Route
            path="/social"
            element={
              <PrivatePage>
                <Social />
              </PrivatePage>
            }
          /> */}
          <Route
            path="/receipt-scanner"
            element={
              <PrivatePage>
                <ReceiptScanner />
              </PrivatePage>
            }
          />
          <Route
            path="/upi-sync"
            element={
              <PrivatePage>
                <UpiSync />
              </PrivatePage>
            }
          />
          <Route
            path="/achievements"
            element={
              <PrivatePage>
                <Achievements />
              </PrivatePage>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>

        <ChatBot />
      </Router>
    </CurrencyProvider>
  );
}

export default App;
