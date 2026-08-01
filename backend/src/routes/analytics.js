const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// ─── GET /api/analytics/summary ──────────────────────────
// Résumé du mois en cours
router.get('/summary', async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysPassed = now.getDate();

  try {
    const { data: budget } = await supabase
      .from('budgets')
      .select('*, budget_categories(*)')
      .eq('user_id', req.user.id)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (!budget) {
      return res.json({ summary: null });
    }

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, date')
      .eq('user_id', req.user.id)
      .eq('budget_id', budget.id);

    const totalSpent = (transactions || [])
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = (transactions || [])
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const remaining = budget.total_income - totalSpent;

    // Projection fin de mois basée sur le rythme actuel
    const dailyRate = totalSpent / daysPassed;
    const projectedTotal = dailyRate * daysInMonth;
    const projectedRemaining = budget.total_income - projectedTotal;

    // Score de santé financière (0-100)
    const spendingRatio = totalSpent / budget.total_income;
    const expectedRatio = daysPassed / daysInMonth;
    let healthScore = 100;
    if (spendingRatio > expectedRatio) {
      healthScore = Math.max(0, Math.round(100 - ((spendingRatio - expectedRatio) * 200)));
    }

    res.json({
      summary: {
        month,
        year,
        total_income: budget.total_income,
        total_spent: totalSpent,
        remaining,
        savings_goal: budget.savings_goal,
        projected_total: Math.round(projectedTotal),
        projected_remaining: Math.round(projectedRemaining),
        health_score: healthScore,
        days_passed: daysPassed,
        days_in_month: daysInMonth,
        budget_categories: budget.budget_categories,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur analytics' });
  }
});

// ─── GET /api/analytics/history ──────────────────────────
// Historique des 12 derniers mois
router.get('/history', async (req, res) => {
  try {
    const { data: budgets } = await supabase
      .from('budgets')
      .select('id, month, year, total_income, savings_goal')
      .eq('user_id', req.user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12);

    if (!budgets || budgets.length === 0) {
      return res.json({ history: [] });
    }

    const history = await Promise.all(budgets.map(async (budget) => {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', req.user.id)
        .eq('budget_id', budget.id);

      const spent = (transactions || [])
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: budget.month,
        year: budget.year,
        income: budget.total_income,
        spent: Math.round(spent),
        saved: Math.round(budget.total_income - spent),
        savings_goal: budget.savings_goal,
      };
    }));

    res.json({ history: history.reverse() });
  } catch (err) {
    res.status(500).json({ error: 'Erreur historique' });
  }
});

module.exports = router;
