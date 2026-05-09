import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Income from "./pages/Income";
import Budget from "./pages/Budget";
import Reports from "./pages/Reports";
import JarSystem from "./pages/JarSystem";
import Social from "./pages/Social";
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
import NotFound from "./pages/NotFound";

// Helper to reduce repetition
const PrivatePage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
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
          <Route
            path="/jar-system"
            element={
              <PrivatePage>
                <JarSystem />
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
          <Route
            path="/social"
            element={
              <PrivatePage>
                <Social />
              </PrivatePage>
            }
          />
          <Route
            path="/receipt-scanner"
            element={
              <PrivatePage>
                <ReceiptScanner />
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
