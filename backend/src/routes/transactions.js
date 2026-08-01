const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// ─── GET /api/transactions ────────────────────────────────
router.get('/', async (req, res) => {
  const { budget_id, category_id, limit = 50, offset = 0 } = req.query;

  try {
    let query = supabase
      .from('transactions')
      .select('*, budget_categories(name, color, icon)')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (budget_id) query = query.eq('budget_id', budget_id);
    if (category_id) query = query.eq('category_id', category_id);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ transactions: data, total: count });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des transactions' });
  }
});

// ─── POST /api/transactions ───────────────────────────────
router.post('/', [
  body('amount').isFloat({ min: 0.01 }),
  body('description').trim().notEmpty(),
  body('category_id').isUUID(),
  body('budget_id').isUUID(),
  body('type').isIn(['expense', 'income']),
  body('date').isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { amount, description, category_id, budget_id, type, date } = req.body;

  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: req.user.id,
        budget_id,
        category_id,
        amount,
        description,
        type,
        date,
      })
      .select('*, budget_categories(name, color, icon)')
      .single();

    if (error) throw error;

    // XP pour chaque transaction enregistrée
    await supabase.rpc('add_xp', { user_id: req.user.id, amount: 5 });

    // Vérifier si la catégorie est en dépassement
    const { data: category } = await supabase
      .from('budget_categories')
      .select('allocated_amount, spent_amount')
      .eq('id', category_id)
      .single();

    const alert = category && (category.spent_amount + amount) > category.allocated_amount
      ? { type: 'warning', message: `⚠️ Budget dépassé pour cette catégorie !` }
      : null;

    res.status(201).json({ transaction: data, xp_earned: 5, alert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la transaction' });
  }
});

// ─── DELETE /api/transactions/:id ────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Transaction supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

module.exports = router;
