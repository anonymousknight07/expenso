import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Income from "./pages/Income";
import Budget from "./pages/Budget";
import Reports from "./pages/Reports";
import JarSystem from "./pages/JarSystem";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Layout from "./components/layout/Layout";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChatBot from "./components/chat/ChatBot";

function App() {
  return (
    <CurrencyProvider>
      <Router>
        <Routes>
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
              <Layout>
                <Dashboard />
              </Layout>
            }
          />
          <Route
            path="/expenses"
            element={
              <Layout>
                <Expenses />
              </Layout>
            }
          />
          <Route
            path="/income"
            element={
              <Layout>
                <Income />
              </Layout>
            }
          />
          <Route
            path="/terms"
            element={
              <Layout>
                <Terms />
              </Layout>
            }
          />
          <Route
            path="/budget"
            element={
              <Layout>
                <Budget />
              </Layout>
            }
          />
          <Route
            path="/reports"
            element={
              <Layout>
                <Reports />
              </Layout>
            }
          />
          <Route
            path="/jar-system"
            element={
              <Layout>
                <JarSystem />
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
          <Route path="/login" element={<Login />} />
          <Route path="/forgotPassword" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
        </Routes>
        <ChatBot />
      </Router>
    </CurrencyProvider>
  );
}

export default App;
