import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Plus, Trash2 } from 'lucide-react';

const DEFAULT_CATEGORIES = [
  { name: 'Logement', icon: '🏠', color: '#6366f1', allocated_amount: 0 },
  { name: 'Alimentation', icon: '🛒', color: '#10b981', allocated_amount: 0 },
  { name: 'Transport', icon: '🚗', color: '#f59e0b', allocated_amount: 0 },
  { name: 'Loisirs', icon: '🎉', color: '#ec4899', allocated_amount: 0 },
  { name: 'Santé', icon: '💊', color: '#14b8a6', allocated_amount: 0 },
  { name: 'Épargne', icon: '💰', color: '#8b5cf6', allocated_amount: 0 },
];

export default function BudgetPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    total_income: '',
    savings_goal: '',
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.get('/budgets').then(r => r.data),
  });

  const createBudget = useMutation({
    mutationFn: (payload) => api.post('/budgets', payload),
    onSuccess: () => {
      qc.invalidateQueries(['budgets']);
      qc.invalidateQueries(['analytics-summary']);
      alert('🎮 Budget créé ! +50 XP gagnés');
    },
    onError: (err) => alert(err.response?.data?.error || 'Erreur'),
  });

  const totalAllocated = form.categories.reduce((s, c) => s + Number(c.allocated_amount || 0), 0);
  const remaining = Number(form.total_income || 0) - totalAllocated;

  const handleSubmit = (e) => {
    e.preventDefault();
    createBudget.mutate({
      ...form,
      total_income: Number(form.total_income),
      savings_goal: Number(form.savings_goal || 0),
      categories: form.categories.map(c => ({
        ...c,
        allocated_amount: Number(c.allocated_amount),
      })),
    });
  };

  const updateCategory = (idx, field, value) => {
    const cats = [...form.categories];
    cats[idx] = { ...cats[idx], [field]: value };
    setForm({ ...form, categories: cats });
  };

  const addCategory = () => {
    setForm({
      ...form,
      categories: [...form.categories, { name: '', icon: '📌', color: '#6366f1', allocated_amount: 0 }],
    });
  };

  const removeCategory = (idx) => {
    setForm({ ...form, categories: form.categories.filter((_, i) => i !== idx) });
  };

  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">💼 Mon Budget</h1>
      <p className="text-gray-400 mb-8">Crée ton budget mensuel et commence ta quête !</p>

      {/* Budgets existants */}
      {data?.budgets?.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-white mb-3">Budgets précédents</h2>
          <div className="space-y-2">
            {data.budgets.map(b => (
              <div key={b.id} className="card py-3 flex justify-between items-center">
                <span className="text-gray-300">{MONTHS[b.month - 1]} {b.year}</span>
                <span className="text-gray-400">{b.total_income} €</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Nouveau budget</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Mois</label>
              <select
                className="input"
                value={form.month}
                onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Année</label>
              <input type="number" className="input" value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Revenus mensuels (€)</label>
              <input type="number" className="input" placeholder="2500" value={form.total_income}
                onChange={(e) => setForm({ ...form, total_income: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Objectif épargne (€)</label>
              <input type="number" className="input" placeholder="300" value={form.savings_goal}
                onChange={(e) => setForm({ ...form, savings_goal: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Catégories */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Catégories de dépenses</h2>
            <button type="button" onClick={addCategory}
              className="btn-secondary text-sm flex items-center gap-1.5">
              <Plus size={14} /> Ajouter
            </button>
          </div>

          <div className="space-y-3">
            {form.categories.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input type="text" value={cat.icon} className="input w-14 text-center text-lg"
                  onChange={(e) => updateCategory(idx, 'icon', e.target.value)} />
                <input type="text" value={cat.name} className="input flex-1" placeholder="Catégorie"
                  onChange={(e) => updateCategory(idx, 'name', e.target.value)} required />
                <input type="number" value={cat.allocated_amount} className="input w-28" placeholder="0"
                  onChange={(e) => updateCategory(idx, 'allocated_amount', e.target.value)} />
                <span className="text-gray-500 text-sm">€</span>
                <button type="button" onClick={() => removeCategory(idx)}
                  className="text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Résumé */}
          <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between">
            <span className="text-gray-400">Total alloué : <strong className="text-white">{totalAllocated} €</strong></span>
            <span className={`font-medium ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Restant : {remaining.toFixed(2)} €
            </span>
          </div>
        </div>

        <button type="submit" className="btn-primary w-full py-3 text-base"
          disabled={createBudget.isPending}>
          {createBudget.isPending ? 'Création...' : '🚀 Lancer la quête du mois !'}
        </button>
      </form>
    </div>
  );
}
