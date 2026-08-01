const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const supabase = require('../lib/supabase');

// Toutes les routes nécessitent une auth
router.use(authMiddleware);

// ─── GET /api/budgets ─────────────────────────────────────
// Récupère tous les budgets de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*, budget_categories(*)')
      .eq('user_id', req.user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw error;
    res.json({ budgets: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des budgets' });
  }
});

// ─── GET /api/budgets/current ─────────────────────────────
// Budget du mois en cours
router.get('/current', async (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*, budget_categories(*)')
      .eq('user_id', req.user.id)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Si pas de budget ce mois-ci, on retourne null avec un message guide
    if (!data) {
      return res.json({ budget: null, message: 'Aucun budget créé pour ce mois. Créez votre première quête !' });
    }

    res.json({ budget: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/budgets ────────────────────────────────────
// Créer un nouveau budget mensuel
router.post('/', [
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2024 }),
  body('total_income').isFloat({ min: 0 }),
  body('categories').isArray({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { month, year, total_income, categories, savings_goal } = req.body;

  try {
    // Vérifier si un budget existe déjà pour ce mois
    const { data: existing } = await supabase
      .from('budgets')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('month', month)
      .eq('year', year)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Un budget existe déjà pour ce mois' });
    }

    // Créer le budget
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .insert({
        user_id: req.user.id,
        month,
        year,
        total_income,
        savings_goal: savings_goal || 0,
      })
      .select()
      .single();

    if (budgetError) throw budgetError;

    // Créer les catégories du budget
    const categoriesWithBudgetId = categories.map(cat => ({
      budget_id: budget.id,
      name: cat.name,
      allocated_amount: cat.allocated_amount,
      color: cat.color || '#6366f1',
      icon: cat.icon || '💰',
    }));

    const { data: budgetCategories, error: catError } = await supabase
      .from('budget_categories')
      .insert(categoriesWithBudgetId)
      .select();

    if (catError) throw catError;

    // Récompense XP pour création d'un budget
    await supabase.rpc('add_xp', { user_id: req.user.id, amount: 50 });

    res.status(201).json({
      budget: { ...budget, budget_categories: budgetCategories },
      xp_earned: 50,
      message: '🎮 Nouvelle quête créée ! +50 XP',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la création du budget' });
  }
});

// ─── PUT /api/budgets/:id ─────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { total_income, savings_goal } = req.body;

  try {
    const { data, error } = await supabase
      .from('budgets')
      .update({ total_income, savings_goal })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ budget: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

module.exports = router;
