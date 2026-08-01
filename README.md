# 🎮 BudgetQuest

> Gérez votre budget comme un jeu RPG. Chaque mois est une nouvelle quête.

## Stack
- **Frontend** : React + Vite + TailwindCSS + shadcn/ui
- **Backend** : ExpressJS + Node.js
- **Base de données** : Supabase (PostgreSQL + Auth)
- **Agents IA** : OpenAI GPT-4o
- **Bot** : Telegram
- **Deploy** : Vercel (frontend + backend)

## Structure
```
budgetquest/
├── frontend/     → React app
├── backend/      → ExpressJS API
├── agents/       → Équipe d'agents IA
├── supabase/     → Migrations SQL
└── .env.example  → Variables d'environnement
```

## Démarrage rapide

### 1. Cloner et installer
```bash
git clone https://github.com/EFP-Alexis-Lemaire/budgetquest.git
cd budgetquest
```

### 2. Backend
```bash
cd backend
npm install
cp ../.env.example .env   # remplir les variables
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables d'environnement
Voir `.env.example` à la racine.
