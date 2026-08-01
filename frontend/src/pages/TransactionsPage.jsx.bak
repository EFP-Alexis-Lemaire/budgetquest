import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Plus, Trash2 } from 'lucide-react';

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    amount: '', description: '', type: 'expense',
    category_id: '', budget_id: '', date: new Date().toISOString().split('T')[0],
  });

  const { data: txData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get('/transactions').then(r => r.data),
  });

  const { data: budgetData } = useQuery({
    queryKey: ['budgets-current'],
    queryFn: () => api.get('/budgets/current').then(r => r.data),
  });

  const addTx = useMutation({
    mutationFn: (payload) => api.post('/transactions', payload),
    onSuccess: (res) => {
      qc.invalidateQueries(['transactions']);
      qc.invalidateQueries(['analytics-summary']);
      setShowForm(false);
      if (res.data.alert) alert(res.data.alert.message);
      else alert(`✅ Transaction ajoutée ! +${res.data.xp_earned} XP`);
    },
    onError: (err) => alert(err.response?.data?.error || 'Erreur'),
  });

  const deleteTx = useMutation({
    mutationFn: (id) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['transactions']);
      qc.invalidateQueries(['analytics-summary']);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!budgetData?.budget) return alert('Crée un budget d\'abord !');
    addTx.mutate({
      ...form,
      amount: Number(form.amount),
      budget_id: form.budget_id || budgetData.budget.id,
    });
  };

  const budget = budgetData?.budget;
  const categories = budget?.budget_categories || [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">💳 Transactions</h1>
          <p className="text-gray-400 mt-1">Enregistre tes dépenses et revenus</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold text-white mb-4">Nouvelle transaction</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Type</label>
                <select className="input" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="expense">💸 Dépense</option>
                  <option value="income">💵 Revenu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Montant (€)</label>
                <input type="number" className="input" placeholder="0.00" step="0.01"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Description</label>
              <input type="text" className="input" placeholder="Courses Lidl"
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Catégorie</label>
                <select className="input" value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })} required>
                  <option value="">Sélectionner...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Date</label>
                <input type="date" className="input" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1" disabled={addTx.isPending}>
                {addTx.isPending ? 'Ajout...' : '✅ Enregistrer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {txData?.transactions?.length === 0 && (
          <div className="card text-center py-8 text-gray-500">
            Aucune transaction pour l'instant. Commence à enregistrer tes dépenses !
          </div>
        )}
        {txData?.transactions?.map((tx) => (
          <div key={tx.id} className="card py-3 flex items-center gap-4">
            <div className="text-2xl">{tx.budget_categories?.icon || '💳'}</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{tx.description}</p>
              <p className="text-xs text-gray-500">
                {tx.budget_categories?.name} · {new Date(tx.date).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <span className={`font-semibold ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
              {tx.type === 'income' ? '+' : '-'}{tx.amount} €
            </span>
            <button onClick={() => deleteTx.mutate(tx.id)}
              className="text-gray-600 hover:text-red-400 transition-colors ml-2">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
