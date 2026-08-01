const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// Définition des badges disponibles
const BADGES = [
  { id: 'first_budget', name: 'Premier pas', description: 'Créer son premier budget', icon: '🗺️', xp: 50 },
  { id: 'streak_3', name: 'Habitude', description: '3 mois consécutifs dans le budget', icon: '🔥', xp: 100 },
  { id: 'streak_6', name: 'Discipline', description: '6 mois consécutifs dans le budget', icon: '⚡', xp: 250 },
  { id: 'streak_12', name: 'Maître du Budget', description: '12 mois consécutifs', icon: '👑', xp: 1000 },
  { id: 'savings_1', name: 'Épargnant', description: 'Premier objectif d\'épargne atteint', icon: '💰', xp: 200 },
  { id: 'savings_5', name: 'Investisseur', description: '5 objectifs d\'épargne atteints', icon: '📈', xp: 500 },
  { id: 'no_overspend', name: 'Budget parfait', description: '0 dépassement en 1 mois', icon: '✨', xp: 150 },
  { id: 'transactions_50', name: 'Comptable', description: '50 transactions enregistrées', icon: '📊', xp: 75 },
  { id: 'level_5', name: 'Apprenti Financier', description: 'Atteindre le niveau 5', icon: '⭐', xp: 0 },
  { id: 'level_10', name: 'Gestionnaire', description: 'Atteindre le niveau 10', icon: '🌟', xp: 0 },
  { id: 'level_20', name: 'Expert Financier', description: 'Atteindre le niveau 20', icon: '💎', xp: 0 },
  { id: 'level_50', name: 'Maître Financier', description: 'Atteindre le niveau 50', icon: '🏆', xp: 0 },
];

// XP requis par niveau (formule progressive)
const xpForLevel = (level) => Math.floor(100 * Math.pow(1.5, level - 1));

// ─── GET /api/gamification/profile ───────────────────────
router.get('/profile', async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('level, xp, streak, name')
      .eq('id', req.user.id)
      .single();

    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', req.user.id);

    const currentLevelXp = xpForLevel(user.level);
    const nextLevelXp = xpForLevel(user.level + 1);

    const earnedBadgeIds = (userBadges || []).map(b => b.badge_id);
    const badges = BADGES.map(badge => ({
      ...badge,
      earned: earnedBadgeIds.includes(badge.id),
      earned_at: userBadges?.find(b => b.badge_id === badge.id)?.earned_at || null,
    }));

    res.json({
      level: user.level,
      xp: user.xp,
      streak: user.streak,
      xp_to_next_level: nextLevelXp - user.xp,
      xp_progress_percent: Math.round(((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100),
      badges,
      badges_earned: earnedBadgeIds.length,
      badges_total: BADGES.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

// ─── GET /api/gamification/leaderboard ───────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('name, level, xp, streak')
      .order('xp', { ascending: false })
      .limit(10);

    if (error) throw error;

    const leaderboard = data.map((user, index) => ({
      rank: index + 1,
      name: user.name,
      level: user.level,
      xp: user.xp,
      streak: user.streak,
    }));

    res.json({ leaderboard });
  } catch (err) {
    res.status(500).json({ error: 'Erreur leaderboard' });
  }
});

module.exports = router;
