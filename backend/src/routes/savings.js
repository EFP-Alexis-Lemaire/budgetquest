const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// ─── GET /api/savings ─────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ goals: data });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des objectifs' });
  }
});

// ─── POST /api/savings ────────────────────────────────────
router.post('/', [
  body('name').trim().notEmpty(),
  body('target_amount').isFloat({ min: 1 }),
  body('monthly_contribution').isFloat({ min: 0 }),
  body('target_date').optional().isISO8601(),
  body('icon').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, target_amount, monthly_contribution, target_date, icon } = req.body;

  // Calcul automatique : dans combien de mois l'objectif sera atteint
  const months_to_goal = monthly_contribution > 0
    ? Math.ceil(target_amount / monthly_contribution)
    : null;

  try {
    const { data, error } = await supabase
      .from('savings_goals')
      .insert({
        user_id: req.user.id,
        name,
        target_amount,
        current_amount: 0,
        monthly_contribution,
        target_date,
        months_to_goal,
        icon: icon || '🎯',
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    // XP pour création d'un objectif
    await supabase.rpc('add_xp', { user_id: req.user.id, amount: 30 });

    res.status(201).json({ goal: data, xp_earned: 30 });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création de l\'objectif' });
  }
});

// ─── PUT /api/savings/:id/contribute ─────────────────────
// Ajouter une contribution à un objectif
router.put('/:id/contribute', [
  body('amount').isFloat({ min: 0.01 }),
], async (req, res) => {
  const { amount } = req.body;

  try {
    const { data: goal } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!goal) return res.status(404).json({ error: 'Objectif introuvable' });

    const new_amount = goal.current_amount + amount;
    const completed = new_amount >= goal.target_amount;

    const { data, error } = await supabase
      .from('savings_goals')
      .update({
        current_amount: new_amount,
        status: completed ? 'completed' : 'active',
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    let xp_earned = 10;
    let message = `+${amount}€ ajoutés à "${goal.name}" 💪`;

    if (completed) {
      xp_earned = 200;
      message = `🏆 Objectif "${goal.name}" atteint ! Félicitations !`;
      // Badge à décerner (géré côté gamification)
    }

    await supabase.rpc('add_xp', { user_id: req.user.id, amount: xp_earned });

    res.json({ goal: data, xp_earned, completed, message });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la contribution' });
  }
});

module.exports = router;
