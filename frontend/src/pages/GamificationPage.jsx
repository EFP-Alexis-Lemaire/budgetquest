import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import QuestCard from '../components/QuestCard';

const fetchQuests = async () => {
  const { data } = await api.get('/quests');
  return data;
};

export default function GamificationPage() {
  const { data: quests, refetch } = useQuery(['quests'], fetchQuests);

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Quêtes Actuelles</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {quests?.map((quest) => (
          <QuestCard key={quest.id} quest={quest} />
        ))}
      </div>
    </div>
  );
}