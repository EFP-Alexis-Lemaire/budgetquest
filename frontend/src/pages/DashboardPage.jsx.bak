import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import useSound from 'use-sound';
import levelUpSound from '../assets/sounds/level-up.mp3';

const XpBar = ({ currentXp, maxXp }) => {
  const [play] = useSound(levelUpSound);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (currentXp >= maxXp) {
      play();
      setShowSparkles(true);
      const timer = setTimeout(() => setShowSparkles(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [currentXp, maxXp, play]);

  const xpPercentage = (currentXp / maxXp) * 100;

  return (
    <div className="relative w-full h-8 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full bg-primary-600 transition-all duration-300"
        style={{ width: `${xpPercentage}%` }}
      />
      {showSparkles && (
        <div className="absolute inset-0 flex justify-center items-center">
          <Sparkles className="text-primary-500 animate-ping" size={48} />
        </div>
      )}
    </div>
  );
};

export default XpBar;