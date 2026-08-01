require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const budgetRoutes = require('./routes/budgets');
const transactionRoutes = require('./routes/transactions');
const savingsRoutes = require('./routes/savings');
const gamificationRoutes = require('./routes/gamification');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Security middleware ──────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ─── Rate limiting ────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Trop de requêtes, réessaie dans 15 minutes.' },
});
app.use('/api/', limiter);

// ─── Parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── Health check ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// ─── Global error handler ────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne',
  });
});

app.listen(PORT, () => {
  console.log(`🚀 BudgetQuest API running on http://localhost:${PORT}`);
});

module.exports = app;

// Investigation Steps
// 1. Ensure the server is running: Verify that the server is started without errors and is listening on the expected port (3001 by default).
// 2. Check for network issues: Ensure there are no firewall rules or network configurations preventing access to the server port.
// 3. Validate Vite proxy configuration: Ensure the Vite development server is correctly configured to proxy requests to the backend server.
// 4. Test connectivity: Use tools like curl or Postman to test if the backend server is accessible at the specified endpoint.
// 5. Check logs: Review server logs for any error messages or connection attempts that might indicate the source of the ECONNREFUSED error.
// 6. Verify environment variables: Ensure that all necessary environment variables, especially PORT and FRONTEND_URL, are correctly set.