require('express');
require('jsonwebtoken');
require('../lib/supabase');

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

let blacklistedTokens = new Set();

router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(400).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    blacklistedTokens.add(token);

    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
});

function isTokenBlacklisted(token) {
  return blacklistedTokens.has(token);
}

module.exports = { router, isTokenBlacklisted };