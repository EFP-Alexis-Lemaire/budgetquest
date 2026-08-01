import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Input } from '../components/Input';

const fetchSuggestions = async () => {
  const { data } = await api.get('/budgets/suggestions');
  return data;
};

export default function BudgetInput() {
  const [inputValue, setInputValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const { data: suggestions } = useQuery(['budgetSuggestions'], fetchSuggestions);

  useEffect(() => {
    if (suggestions) {
      const filtered = suggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredSuggestions(filtered);
    }
  }, [inputValue, suggestions]);

  return (
    <div className="relative">
      <Input
        className="input"
        placeholder="Enter budget..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      {filteredSuggestions.length > 0 && (
        <ul className="absolute bg-gray-800 border border-gray-700 rounded-xl mt-1 w-full max-h-40 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={index}
              className="px-4 py-2 hover:bg-gray-700 cursor-pointer"
              onClick={() => setInputValue(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}