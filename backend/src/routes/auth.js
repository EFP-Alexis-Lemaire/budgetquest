require('dotenv').config({ path: '../.env' });
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// ─── Register User ────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      logger.warn('Registration attempt with missing fields');
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info(`Registration attempt with existing email: ${email}`);
      return res.status(409).json({ error: 'Email déjà utilisé' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword });
    await user.save();
    logger.info(`User registered successfully: ${email}`);
    res.status(201).json({ message: 'Utilisateur créé avec succès' });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// ─── Login User ───────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      logger.warn('Login attempt with missing fields');
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      logger.info(`Login attempt with non-existent email: ${email}`);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.info(`Invalid password attempt for email: ${email}`);
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    logger.info(`User logged in successfully: ${email}`);
    res.json({ token });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

module.exports = router;