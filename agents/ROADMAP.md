# BudgetQuest — Roadmap & Priorités

## Règle de priorité pour les agents
Les agents DOIVENT respecter cet ordre strict :
- Tant qu'il reste des tâches MUST HAVE non complétées → ne proposer QUE des must have
- Tant qu'il reste des SHOULD HAVE non complétées → ne proposer QUE des should have
- Les NICE TO HAVE (effets CSS, animations, polish) ne sont autorisés que si TOUT le reste est fait

---

## 🔴 MUST HAVE — Fonctionnalités core (application inutilisable sans elles)

### Authentification
- [x] Inscription / Connexion avec email + mot de passe
- [x] JWT token + middleware auth backend
- [x] Protection des routes frontend (redirect si non connecté)
- [ ] Page profil utilisateur (nom, email, avatar, stats globales)
- [x] Déconnexion propre avec suppression token

### Budget mensuel
- [x] Création d'un budget mensuel avec catégories
- [x] Calcul revenus - dépenses = solde restant
- [ ] Modification d'un budget existant (changer montants alloués)
- [ ] Duplication du budget du mois précédent (bouton "Reprendre ce budget")

### Transactions
- [x] Ajout d'une transaction (dépense ou revenu)
- [x] Liste des transactions du mois
- [x] Suppression d'une transaction
- [ ] Modification d'une transaction existante (edit inline)
- [ ] Filtre par catégorie et par date sur la liste

### Épargne
- [x] Création d'objectifs d'épargne
- [x] Ajout de contributions
- [x] Calcul automatique "atteint en X mois"
- [ ] Modification d'un objectif (changer le montant cible ou la contribution)
- [ ] Suppression d'un objectif

### Gamification
- [x] Système XP + niveaux
- [x] Badges définis (12 badges)
- [ ] Attribution automatique des badges (trigger quand condition remplie)
- [ ] Mise à jour du streak mensuel (chaque 1er du mois)
- [ ] Notification in-app quand badge débloqué

---

## 🟡 SHOULD HAVE — Fonctionnalités importantes (valeur ajoutée significative)

### Analytics
- [x] Historique 12 mois (revenus vs dépenses)
- [x] Courbe épargne mensuelle
- [ ] Graphique camembert dépenses par catégorie (sur le dashboard)
- [ ] Score de santé financière détaillé avec conseils personnalisés
- [ ] Tableau de bord avec tendances (dépense moyenne, taux épargne moyen)

### Expérience utilisateur
- [ ] Composant Toast/notification pour les gains XP (+50 XP !)
- [ ] Page 404 stylisée thème RPG
- [ ] Loading skeletons sur les pages qui chargent des données
- [ ] Confirmation avant suppression (modal ou inline)
- [ ] Message d'erreur friendly quand l'API est indisponible

### Export / Import
- [ ] Export CSV des transactions du mois (bouton télécharger)
- [ ] Import transactions depuis fichier CSV bancaire

### Budget
- [ ] Suggestions de catégories intelligentes (basées sur l'historique)
- [ ] Alerte visuelle quand une catégorie dépasse 80% du budget alloué

---

## 🟢 NICE TO HAVE — Polish et extras (seulement quand tout le reste est fait)

### Animations et effets visuels
- [ ] Animation confetti quand un badge est débloqué
- [ ] Transition de page (fade in/out)
- [ ] Micro-animations sur les boutons (hover effects)
- [ ] Effet de particules sur le level-up
- [ ] Barre XP animée avec effet de lueur pulsant

### Features avancées
- [ ] Mode couple (budget partagé entre 2 utilisateurs)
- [ ] Notifications push navigateur
- [ ] Thème clair complet (actuellement dark only)
- [ ] Raccourcis clavier pour les actions fréquentes
- [ ] Chatbot IA pour conseils budgétaires personnalisés

---

## État actuel du projet
Dernière mise à jour : automatique à chaque cycle

### Fonctionnalités opérationnelles
- Auth complète (register/login/JWT)
- Budget mensuel avec catégories
- Transactions (add/delete)
- Épargne avec objectifs
- Gamification (XP/niveaux/badges affichés)
- Analytics (historique)
- Dark theme
- ThemeSwitcher (dark/light/auto)

### Problèmes connus
- Attribution des badges non automatique (badges jamais débloqués)
- Streak non mis à jour automatiquement
- Pas de modification possible (transactions, budgets, objectifs)
