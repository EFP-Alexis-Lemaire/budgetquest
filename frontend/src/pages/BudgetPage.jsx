import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

const BudgetPage = () => {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  const { data: budgetData, refetch } = useQuery(['budget'], async () => {
    const response = await api.get('/budget');
    return response.data;
  });

  useEffect(() => {
    if (budgetData) {
      const labels = budgetData.categories.map((category) => category.name);
      const budgetAllocation = budgetData.categories.map((category) => category.budget);
      const spending = budgetData.categories.map((category) => category.spent);

      setChartData({
        labels,
        datasets: [
          {
            label: 'Budget Allocation',
            data: budgetAllocation,
            backgroundColor: '#6366f1',
          },
          {
            label: 'Spending',
            data: spending,
            backgroundColor: '#4b5563',
          },
        ],
      });
    }
  }, [budgetData]);

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Budget Overview</h2>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                color: '#ffffff',
              },
            },
          },
          scales: {
            x: {
              ticks: {
                color: '#ffffff',
              },
            },
            y: {
              ticks: {
                color: '#ffffff',
              },
            },
          },
        }}
      />
    </div>
  );
};

export default BudgetPage;