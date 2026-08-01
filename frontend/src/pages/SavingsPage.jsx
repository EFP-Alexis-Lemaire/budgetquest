import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Plus } from 'lucide-react';

export default function SavingsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', target_amount: '', monthly_contribution: '', icon: '🎯' });
  const [contribute, setContribute] = useState({ goalId: null, amount: '' });

  const { data } = useQuery({
    queryKey: ['savings'],
    queryFn: () => api.get('/savings').then(r => r.data),
  });

  const createGoal = useMutation({
    mutationFn: (p) => api.post('/savings', p),
    onSuccess: () => { qc.invalidateQueries(['savings']); setShowForm(false); },
  });

  const addContribution = useMutation({
    mutationFn: ({ id, amount }) => api.put(`/savings/${id}/contribute`, { amount: Number(amount) }),
    onSuccess: (res) => {
      qc.invalidateQueries(['savings']);
      setContribute({ goalId: null, amount: '' });
      alert(res.data.message);
    },
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">🐷 Épargne</h1>
          <p className="text-gray-400 mt-1">Tes objectifs d'épargne</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvel objectif
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-white mb-4">Créer un objectif</h2>
          <form onSubmit={(e) => { e.preventDefault(); createGoal.mutate({ ...form, target_amount: Number(form.target_amount), monthly_contribution: Number(form.monthly_contribution) }); }}
            className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Icône</label>
                <input className="input" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom</label>
                <input className="input" placeholder="Vacances à Bali" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Objectif (€)</label>
                <input type="number" className="input" placeholder="2000" value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Contribution/mois (€)</label>
                <input type="number" className="input" placeholder="200" value={form.monthly_contribution}
                  onChange={(e) => setForm({ ...form, monthly_contribution: e.target.value })} required />
              </div>
            </div>
            {form.target_amount && form.monthly_contribution && (
              <p className="text-sm text-primary-400">
                📅 Objectif atteint en ~{Math.ceil(Number(form.target_amount) / Number(form.monthly_contribution))} mois
              </p>
            )}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={createGoal.isPending}>
                {createGoal.isPending ? 'Création...' : '🎯 Créer l\'objectif'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-4">
        {data?.goals?.map((goal) => {
          const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
          return (
            <div key={goal.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{goal.icon}</span>
                  <div>
                    <p className="font-medium text-white">{goal.name}</p>
                    {goal.months_to_goal && (
                      <p className="text-xs text-gray-500">~{goal.months_to_goal} mois restants</p>
                    )}
                  </div>
                </div>
                {goal.status === 'completed' ? (
                  <span className="badge bg-green-500/20 text-green-400">🏆 Atteint</span>
                ) : (
                  <span className="text-sm font-medium text-white">{pct}%</span>
                )}
              </div>

              <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${goal.status === 'completed' ? 'bg-green-500' : 'bg-gradient-to-r from-primary-500 to-purple-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-400 mb-3">
                <span>{goal.current_amount} € épargnés</span>
                <span>Objectif : {goal.target_amount} €</span>
              </div>

              {goal.status !== 'completed' && (
                contribute.goalId === goal.id ? (
                  <div className="flex gap-2">
                    <input type="number" className="input flex-1" placeholder="Montant (€)"
                      value={contribute.amount} onChange={(e) => setContribute({ ...contribute, amount: e.target.value })} />
                    <button className="btn-primary"
                      onClick={() => addContribution.mutate({ id: goal.id, amount: contribute.amount })}>
                      Ajouter
                    </button>
                    <button className="btn-secondary" onClick={() => setContribute({ goalId: null, amount: '' })}>✕</button>
                  </div>
                ) : (
                  <button className="btn-secondary text-sm"
                    onClick={() => setContribute({ goalId: goal.id, amount: '' })}>
                    + Ajouter une contribution
                  </button>
                )
              )}
            </div>
          );
        })}

        {data?.goals?.length === 0 && (
          <div className="card text-center py-8 text-gray-500">
            Aucun objectif d'épargne. Crée ton premier objectif !
          </div>
        )}
      </div>
    </div>
  );
}
