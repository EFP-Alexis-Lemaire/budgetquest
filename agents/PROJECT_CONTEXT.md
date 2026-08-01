# BudgetQuest — Contexte Projet pour les Agents IA

## Description
Application web de gestion de budget personnelle avec gamification RPG.
L'utilisateur crée un budget mensuel, enregistre ses dépenses, suit ses objectifs d'épargne
et gagne des XP/badges pour récompenser ses bonnes habitudes financières.

## Stack FIXE (ne jamais changer)
- Frontend : React 18 + Vite + TailwindCSS (dark theme) + TanStack Query + Zustand + Recharts + lucide-react
- Backend  : Express.js + Node.js
- Database : Supabase (PostgreSQL)
- Auth     : JWT maison (pas Supabase Auth)
- Deploy   : Vercel

## Structure des fichiers PROTÉGÉS (ne jamais réécrire entièrement)

### Frontend — Pages CORE (modifier avec précaution)
- frontend/src/pages/DashboardPage.jsx   → Tableau de bord principal
- frontend/src/pages/BudgetPage.jsx      → Création budget mensuel
- frontend/src/pages/TransactionsPage.jsx → Liste et ajout de transactions
- frontend/src/pages/SavingsPage.jsx     → Objectifs d'épargne
- frontend/src/pages/GamificationPage.jsx → Badges, niveaux, leaderboard
- frontend/src/pages/AnalyticsPage.jsx   → Graphiques historique
- frontend/src/pages/LoginPage.jsx       → Connexion
- frontend/src/pages/RegisterPage.jsx    → Inscription

### Frontend — Infrastructure (NE JAMAIS TOUCHER)
- frontend/src/App.jsx          → Routes React Router
- frontend/src/main.jsx         → Point d'entrée React
- frontend/src/index.css        → Classes CSS globales (card, btn-primary, input, badge)
- frontend/src/lib/api.js       → Client Axios avec intercepteurs JWT
- frontend/src/store/authStore.js → État auth (Zustand + persist)

### Backend — Routes (modifier avec précaution)
- backend/src/routes/auth.js
- backend/src/routes/budgets.js
- backend/src/routes/transactions.js
- backend/src/routes/savings.js
- backend/src/routes/gamification.js
- backend/src/routes/analytics.js

### Backend — Infrastructure (NE JAMAIS TOUCHER)
- backend/src/index.js          → Serveur Express principal
- backend/src/lib/supabase.js   → Client Supabase
- backend/src/middleware/auth.js → Middleware JWT

## Composants existants
- frontend/src/components/Layout.jsx      → Sidebar + navigation
- frontend/src/components/ThemeSwitcher.jsx → Toggle dark/light/auto
- frontend/src/components/QuestCard.jsx   → Carte de badge/quête

## Classes CSS disponibles (définies dans index.css)
- .card          → Conteneur dark avec border
- .btn-primary   → Bouton violet principal
- .btn-secondary → Bouton gris secondaire
- .input         → Champ de formulaire
- .badge         → Étiquette inline

## Routes API disponibles
GET    /api/auth/me
POST   /api/auth/login
POST   /api/auth/register
GET    /api/budgets
GET    /api/budgets/current
POST   /api/budgets
PUT    /api/budgets/:id
GET    /api/transactions
POST   /api/transactions
DELETE /api/transactions/:id
GET    /api/savings
POST   /api/savings
PUT    /api/savings/:id/contribute
GET    /api/gamification/profile
GET    /api/gamification/leaderboard
GET    /api/analytics/summary
GET    /api/analytics/history

## Schéma base de données
Tables : users, budgets, budget_categories, transactions, savings_goals, user_badges
Fonction SQL : add_xp(user_id, amount) → gère les niveaux automatiquement
Trigger : update_category_spent → met à jour spent_amount automatiquement

## Règles ABSOLUES pour les agents

### Ce qu'un agent PEUT faire
- Créer de NOUVEAUX composants dans frontend/src/components/
- Créer de NOUVEAUX fichiers utilitaires dans frontend/src/lib/
- Ajouter des fonctionnalités à une page existante (MODIFIER, pas réécrire)
- Créer de NOUVELLES routes backend dans backend/src/routes/
- Améliorer le style avec les classes Tailwind existantes

### Ce qu'un agent NE DOIT PAS faire
- Réécrire entièrement une page existante
- Importer des composants qui n'existent pas encore
- Importer des fichiers audio/image sans vérifier qu'ils existent
- Utiliser des librairies non installées (use-sound, framer-motion, etc.)
- Créer des routes API qui n'existent pas et les appeler depuis le frontend
- Mettre plusieurs composants dans un seul fichier
- Utiliser des blocs markdown dans le code
- Modifier App.jsx, main.jsx, index.css, api.js, authStore.js sans raison critique

### Librairies installées (UNIQUEMENT celles-ci)
Frontend : react, react-dom, react-router-dom, @tanstack/react-query, axios,
           zustand, recharts, lucide-react, clsx, tailwind-merge, date-fns, @supabase/supabase-js
Backend  : express, @supabase/supabase-js, bcryptjs, jsonwebtoken, cors, helmet,
           morgan, express-rate-limit, express-validator, dotenv

## Idées d'améliorations prioritaires (à implémenter progressivement)
1. Composant Toast/notification pour les gains XP (nouveau fichier)
2. Page profil utilisateur avec statistiques personnelles (nouvelle page)
3. Graphique camembert des dépenses par catégorie sur le Dashboard
4. Système d'alertes email quand budget dépassé (backend)
5. Export CSV des transactions (backend + bouton frontend)
6. Animation confetti quand un badge est débloqué (nouveau composant)
7. Raccourcis clavier pour ajouter une transaction rapidement
8. Score de santé financière plus détaillé avec conseils
