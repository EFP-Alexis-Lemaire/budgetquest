import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, PlusCircle } from 'lucide-react';
import api from '../lib/api';

const BudgetPage = () => {
  const queryClient = useQueryClient();
  const { data: budgets, isLoading } = useQuery(['budgets'], () =>
    api.get('/budgets').then((res) => res.data)
  );

  const addBudgetMutation = useMutation(
    (newBudget) => api.post('/budgets', newBudget),
    {
      onSuccess: () => queryClient.invalidateQueries(['budgets']),
    }
  );

  const deleteBudgetMutation = useMutation(
    (id) => api.delete(`/budgets/${id}`),
    {
      onSuccess: () => queryClient.invalidateQueries(['budgets']),
    }
  );

  const [newBudget, setNewBudget] = useState('');

  const handleAddBudget = () => {
    if (newBudget.trim()) {
      addBudgetMutation.mutate({ name: newBudget });
      setNewBudget('');
    }
  };

  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-4">Budgets</h1>
      <div className="flex items-center mb-4">
        <input
          type="text"
          className="input mr-2"
          placeholder="New Budget"
          value={newBudget}
          onChange={(e) => setNewBudget(e.target.value)}
        />
        <button
          className="btn-primary flex items-center"
          onClick={handleAddBudget}
        >
          <PlusCircle className="mr-1" size={20} />
          Add
        </button>
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <ul className="space-y-2">
          {budgets.map((budget) => (
            <li
              key={budget.id}
              className={`flex justify-between items-center p-4 bg-gray-800 rounded-xl transition-transform transform hover:scale-105 ${
                budget.exceeded ? 'border border-red-500' : ''
              }`}
            >
              <span>{budget.name}</span>
              <button
                className="btn-secondary flex items-center"
                onClick={() => deleteBudgetMutation.mutate(budget.id)}
              >
                <Trash2 className="mr-1" size={20} />
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BudgetPage;