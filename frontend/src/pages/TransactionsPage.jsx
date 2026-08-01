import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Calendar, DollarSign, Filter } from 'lucide-react';
import api from '../lib/api';

const TransactionsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [category, setCategory] = useState('');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });

  const { data: transactions, isLoading } = useQuery(['transactions', searchTerm, dateRange, category, amountRange], async () => {
    const { data } = await api.get('/transactions', {
      params: {
        search: searchTerm,
        startDate: dateRange.start,
        endDate: dateRange.end,
        category,
        minAmount: amountRange.min,
        maxAmount: amountRange.max,
      },
    });
    return data;
  });

  return (
    <div className="p-6">
      <div className="card mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              className="input"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="text-gray-500" />
            <input
              type="date"
              className="input"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              className="input"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-500" />
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="food">Food</option>
              <option value="transport">Transport</option>
              <option value="entertainment">Entertainment</option>
              {/* Add more categories as needed */}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="text-gray-500" />
            <input
              type="number"
              className="input"
              placeholder="Min"
              value={amountRange.min}
              onChange={(e) => setAmountRange({ ...amountRange, min: e.target.value })}
            />
            <span className="text-gray-500">to</span>
            <input
              type="number"
              className="input"
              placeholder="Max"
              value={amountRange.max}
              onChange={(e) => setAmountRange({ ...amountRange, max: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="card">
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {transactions.map((transaction) => (
              <li key={transaction.id} className="border-b border-gray-800 py-2">
                <div className="flex justify-between">
                  <span>{transaction.description}</span>
                  <span>{transaction.amount}</span>
                </div>
                <div className="text-sm text-gray-500">
                  {transaction.category} - {new Date(transaction.date).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage;