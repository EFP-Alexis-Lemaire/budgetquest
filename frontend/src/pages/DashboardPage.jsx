import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { TrendingUp, TrendingDown, Target, Zap, Plus } from 'lucide-react';

function XpBar({ xp, level }) {
  const xpForLevel = (l) => Math.floor(100 * Math.pow(1.5, l - 1));
  const current = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const percent = Math.min(100, Math.round(((xp - current) / (next - current)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Niveau {level}</span>
        <span>{xp} / {next} XP</span>
      </div>
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: percent + '%' }}
        />
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-primary-400 to-purple-400 rounded-full opacity-40 blur-sm transition-all duration-500"
          style={{ width: percent + '%' }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="card flex items-center gap-4 hover:border-gray-700 transition-colors">
      <div className={'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ' + color}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: summaryData } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => api.get('/analytics/summary').then(r => r.data),
  });

  const { data: gamificationData } = useQuery({
    queryKey: ['gamification-profile'],
    queryFn: () => api.get('/gamification/profile').then(r => r.data),
  });

  const summary = summaryData?.summary;
  const gami = gamificationData;
  const fmt = (v) => Number(v || 0).toFixed(2) + ' €';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Bonjour, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-gray-400 mt-1">Voici ton tableau de bord financier</p>
      </div>

      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚔️</span>
            <span className="font-semibold text-white">Progression du héros</span>
          </div>
          <span className="badge bg-primary-500/20 text-primary-400">
            🔥 Streak : {user?.streak || 0} mois
          </span>
        </div>
        <XpBar xp={user?.xp || 0} level={user?.level || 1} />
        <div className="flex gap-4 mt-4">
          <span className="text-sm text-gray-400">
            🏅 {gami?.badges_earned || 0} / {gami?.badges_total || 0} badges
          </span>
          <Link to="/gamification" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
            Voir les quêtes →
          </Link>
        </div>
      </div>

      {summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Revenus du mois" value={fmt(summary.total_income)} icon={TrendingUp} color="bg-green-600" />
            <StatCard label="Dépensé" value={fmt(summary.total_spent)} icon={TrendingDown} color="bg-red-500" sub={summary.days_passed + '/' + summary.days_in_month + ' jours'} />
            <StatCard label="Restant" value={fmt(summary.remaining)} icon={Zap} color={summary.remaining >= 0 ? 'bg-primary-600' : 'bg-orange-500'} />
            <StatCard label="Score santé" value={summary.health_score + '/100'} icon={Target} color="bg-purple-600" sub="Score financier" />
          </div>

          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">📊 Projection fin de mois</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-sm text-gray-400">Dépenses projetées</p>
                <p className="text-xl font-bold text-white">{fmt(summary.projected_total)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Solde projeté</p>
                <p className={'text-xl font-bold ' + (summary.projected_remaining >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {fmt(summary.projected_remaining)}
                </p>
              </div>
              {summary.savings_goal > 0 && (
                <div>
                  <p className="text-sm text-gray-400">Objectif épargne</p>
                  <p className="text-xl font-bold text-yellow-400">{fmt(summary.savings_goal)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-4">📂 Budget par catégorie</h2>
            <div className="space-y-3">
              {summary.budget_categories?.map((cat) => {
                const pct = Math.min(100, Math.round((cat.spent_amount / cat.allocated_amount) * 100));
                const over = cat.spent_amount > cat.allocated_amount;
                return (
                  <div key={cat.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">{cat.icon} {cat.name}</span>
                      <span className={over ? 'text-red-400' : 'text-gray-400'}>
                        {fmt(cat.spent_amount)} / {fmt(cat.allocated_amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={'h-full rounded-full transition-all duration-500 ' + (over ? 'bg-red-500' : 'bg-primary-500')}
                        style={{ width: pct + '%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <p className="text-4xl mb-4">🗺️</p>
          <h2 className="text-xl font-semibold text-white mb-2">Nouvelle quête disponible !</h2>
          <p className="text-gray-400 mb-6">Tu n'as pas encore créé ton budget pour ce mois.</p>
          <Link to="/budget" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> Créer mon budget
          </Link>
        </div>
      )}
    </div>
  );
}
