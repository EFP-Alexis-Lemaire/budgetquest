import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import QuestCard from '../components/QuestCard';
import clsx from 'clsx';

export default function GamificationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: () => api.get('/gamification/profile').then(r => r.data),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/gamification/leaderboard').then(r => r.data),
  });

  if (isLoading) {
    return <div className="p-8 text-gray-400">Chargement...</div>;
  }

  const xpForLevel = (l) => Math.floor(100 * Math.pow(1.5, l - 1));
  const currentLvlXp = xpForLevel(data?.level || 1);
  const nextLvlXp = xpForLevel((data?.level || 1) + 1);
  const pct = Math.min(100, Math.round(
    ((data?.xp - currentLvlXp) / (nextLvlXp - currentLvlXp)) * 100
  ));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">🏆 Quêtes et Récompenses</h1>
      <p className="text-gray-400 mb-8">Ta progression dans l'aventure financière</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Niveau */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">⚔️ Ton niveau</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center text-2xl font-bold text-white shrink-0">
              {data?.level}
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Niveau {data?.level}</p>
              <p className="text-sm text-gray-400">{data?.xp} XP total</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Vers niveau {(data?.level || 1) + 1}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: pct + '%' }}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3 flex-wrap text-sm">
            <div className="bg-gray-800 rounded-xl px-3 py-2">
              🔥 Streak : <strong className="text-white">{data?.streak || 0} mois</strong>
            </div>
            <div className="bg-gray-800 rounded-xl px-3 py-2">
              🏅 <strong className="text-white">{data?.badges_earned || 0}</strong> / {data?.badges_total || 0} badges
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card">
          <h2 className="font-semibold text-white mb-4">🥇 Classement</h2>
          <div className="space-y-2">
            {leaderboard?.leaderboard?.map((entry) => (
              <div key={entry.rank} className="flex items-center gap-3 py-1.5">
                <span className={clsx('w-7 text-center font-bold text-sm', {
                  'text-yellow-400': entry.rank === 1,
                  'text-gray-400':   entry.rank === 2,
                  'text-orange-500': entry.rank === 3,
                  'text-gray-600':   entry.rank > 3,
                })}>
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '#' + entry.rank}
                </span>
                <span className="flex-1 text-gray-300 text-sm">{entry.name}</span>
                <span className="text-xs text-gray-500">Niv.{entry.level}</span>
                <span className="text-sm font-medium text-primary-400">{entry.xp} XP</span>
              </div>
            ))}
            {!leaderboard?.leaderboard?.length && (
              <p className="text-gray-500 text-sm">Sois le premier dans le classement !</p>
            )}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="card">
        <h2 className="font-semibold text-white mb-6">🎖️ Badges</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.badges?.map((badge) => (
            <QuestCard key={badge.id} badge={badge} />
          ))}
        </div>
      </div>
    </div>
  );
}
