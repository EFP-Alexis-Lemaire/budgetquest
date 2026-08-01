// === frontend/src/pages/DashboardPage.jsx ===
import React from 'react';
import { useState, useEffect } from 'react';

const XpBar = ({ currentXp, maxXp }) => {
  const [xpPercentage, setXpPercentage] = useState((currentXp / maxXp) * 100);

  useEffect(() => {
    setXpPercentage((currentXp / maxXp) * 100);
  }, [currentXp, maxXp]);

  return (
    <div className="relative w-full h-6 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full bg-primary-600 transition-all duration-500 ease-in-out"
        style={{ width: `${xpPercentage}%` }}
      />
      <div
        className="absolute top-0 left-0 h-full bg-primary-600 opacity-50 blur-md transition-all duration-500 ease-in-out"
        style={{ width: `${xpPercentage}%` }}
      />
    </div>
  );
};

const DashboardPage = () => {
  const [currentXp, setCurrentXp] = useState(50); // Example current XP
  const maxXp = 100; // Example max XP

  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <XpBar currentXp={currentXp} maxXp={maxXp} />
      {/* Example button to increase XP for demonstration */}
      <button
        className="btn-primary mt-4"
        onClick={() => setCurrentXp((prev) => Math.min(prev + 10, maxXp))}
      >
        Gain XP
      </button>
    </div>
  );
};

export default DashboardPage;

### Explications :
- **Animation CSS** : La barre de progression utilise `transition-all` avec `duration-500` et `ease-in-out` pour une animation fluide lors de la mise à jour de la largeur.
- **Effet de lueur** : Une deuxième div avec `opacity-50` et `blur-md` crée un effet de lueur autour de la barre.
- **Gestion de l'état** : `useState` et `useEffect` sont utilisés pour gérer et mettre à jour le pourcentage d'XP.
- **Bouton de démonstration** : Un bouton est inclus pour simuler l'augmentation de l'XP.