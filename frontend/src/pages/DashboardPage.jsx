// frontend/src/components/Badge.jsx
import { BadgeCheck } from 'lucide-react';

const Badge = ({ title, description }) => (
  <div className="badge bg-primary-600 text-white">
    <BadgeCheck className="w-4 h-4" />
    <div>
      <div className="font-bold">{title}</div>
      <div className="text-xs">{description}</div>
    </div>
  </div>
);

export default Badge;

// frontend/src/pages/DashboardPage.jsx
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import Badge from '../components/Badge';

const DashboardPage = () => {
  const { data: badges } = useQuery(['badges'], async () => {
    const { data } = await api.get('/badges');
    return data;
  });

  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="flex flex-wrap gap-4">
        {badges?.map((badge) => (
          <Badge key={badge.id} title={badge.title} description={badge.description} />
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;

// frontend/src/pages/ProfilePage.jsx
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import Badge from '../components/Badge';

const ProfilePage = () => {
  const { data: badges } = useQuery(['userBadges'], async () => {
    const { data } = await api.get('/user/badges');
    return data;
  });

  return (
    <div className="card">
      <h1 className="text-2xl font-bold mb-4">Profile</h1>
      <div className="flex flex-wrap gap-4">
        {badges?.map((badge) => (
          <Badge key={badge.id} title={badge.title} description={badge.description} />
        ))}
      </div>
    </div>
  );
};

export default ProfilePage;

// frontend/src/App.jsx
import ProfilePage from './pages/ProfilePage';

// Add the ProfilePage route
<Route path="profile" element={<ProfilePage />} />