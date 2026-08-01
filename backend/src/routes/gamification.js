const express = require('express');
const supabase = require('../lib/supabase');
const router = express.Router();

// Middleware to validate user authentication
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès non autorisé' });

  try {
    const { data, error } = await supabase.auth.api.getUser(token);
    if (error || !data) return res.status(401).json({ error: 'Token invalide' });
    req.user = data;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
};

// Function to reset daily challenges
const resetDailyChallenges = async () => {
  try {
    const { error } = await supabase
      .from('challenges')
      .update({ completed: false })
      .eq('daily', true);
    if (error) throw error;
  } catch (err) {
    console.error('Erreur lors de la réinitialisation des défis quotidiens:', err);
  }
};

// Endpoint to get daily challenges
router.get('/daily', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('daily', true)
      .eq('completed', false);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des défis quotidiens' });
  }
});

// Endpoint to complete a challenge
router.post('/complete', authenticateUser, async (req, res) => {
  const { challengeId } = req.body;
  if (!challengeId) return res.status(400).json({ error: 'ID de défi requis' });

  try {
    const { data, error } = await supabase
      .from('challenges')
      .update({ completed: true })
      .eq('id', challengeId)
      .eq('daily', true)
      .eq('completed', false);
    if (error || !data.length) return res.status(400).json({ error: 'Défi non trouvé ou déjà complété' });

    // Reward logic here (e.g., add XP or badges)
    // ...

    res.json({ message: 'Défi complété avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la complétion du défi' });
  }
});

// Schedule daily reset at midnight
const schedule = require('node-schedule');
schedule.scheduleJob('0 0 * * *', resetDailyChallenges);

module.exports = router;