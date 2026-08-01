import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BudgetPage from './pages/BudgetPage';
import TransactionsPage from './pages/TransactionsPage';
import SavingsPage from './pages/SavingsPage';
import GamificationPage from './pages/GamificationPage';
import AnalyticsPage from './pages/AnalyticsPage';

// Route protégée
const ProtectedRoute = ({ children }) => {
  const { token } = useAuthStore();
  return token ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="budget" element={<BudgetPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="savings" element={<SavingsPage />} />
        <Route path="gamification" element={<GamificationPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}