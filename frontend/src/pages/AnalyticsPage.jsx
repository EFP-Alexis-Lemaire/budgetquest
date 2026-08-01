import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function AnalyticsPage() {
  const { data: historyData } = useQuery({
    queryKey: ['analytics-history'],
    queryFn: () => api.get('/analytics/history').then(r => r.data),
  });

  const history = (historyData?.history || []).map(h => ({
    ...h,
    name: MONTHS[h.month - 1] + ' ' + h.year,
  }));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">📊 Analytics</h1>
      <p className="text-gray-400 mb-8">Visualise tes tendances financières</p>

      {history.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Pas encore assez de données. Crée des budgets pour voir tes statistiques.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold text-white mb-6">Revenus vs Dépenses</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 12 }} labelStyle={{ color: '#f9fafb' }} />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="income" name="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-6">Épargne mensuelle</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 12 }} labelStyle={{ color: '#f9fafb' }} />
                <Line type="monotone" dataKey="saved" name="Épargné (€)" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
                <Line type="monotone" dataKey="savings_goal" name="Objectif (€)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h2 className="font-semibold text-white mb-4">Récapitulatif</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="pb-3 text-left">Mois</th>
                  <th className="pb-3 text-right">Revenus</th>
                  <th className="pb-3 text-right">Dépenses</th>
                  <th className="pb-3 text-right">Épargné</th>
                  <th className="pb-3 text-right">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {history.map((row, i) => {
                  const rate = row.income > 0 ? Math.round((row.saved / row.income) * 100) : 0;
                  return (
                    <tr key={i} className="text-gray-300">
                      <td className="py-3">{row.name}</td>
                      <td className="py-3 text-right text-green-400">{row.income} €</td>
                      <td className="py-3 text-right text-red-400">{row.spent} €</td>
                      <td className="py-3 text-right text-primary-400">{row.saved} €</td>
                      <td className="py-3 text-right">
                        <span className={'badge text-xs ' + (rate >= 20 ? 'bg-green-500/20 text-green-400' : rate >= 10 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
