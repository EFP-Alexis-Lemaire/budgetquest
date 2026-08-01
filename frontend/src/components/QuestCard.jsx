import clsx from 'clsx';

export default function QuestCard({ badge }) {
  return (
    <div className={clsx(
      'rounded-2xl p-4 text-center transition-all border',
      badge.earned
        ? 'bg-primary-600/20 border-primary-500/30'
        : 'bg-gray-800/50 border-gray-800 opacity-50 grayscale'
    )}>
      <div className="text-3xl mb-2">{badge.icon}</div>
      <p className="text-sm font-medium text-white">{badge.name}</p>
      <p className="text-xs text-gray-400 mt-1">{badge.description}</p>
      {badge.xp > 0 && (
        <p className="text-xs text-primary-400 mt-2">+{badge.xp} XP</p>
      )}
      {badge.earned && badge.earned_at && (
        <p className="text-xs text-green-400 mt-1">
          ✓ {new Date(badge.earned_at).toLocaleDateString('fr-FR')}
        </p>
      )}
    </div>
  );
}
