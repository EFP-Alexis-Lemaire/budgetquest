import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BadgeCheck } from 'lucide-react';

const NotificationSystem = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleNewBadge = (badge) => {
      toast(
        <div className="flex items-center gap-3">
          <BadgeCheck className="text-primary-600" />
          <div>
            <p className="font-bold">{badge.title}</p>
            <p className="text-sm">{badge.description}</p>
          </div>
        </div>,
        {
          className: 'bg-gray-900 text-gray-100 border border-gray-800 rounded-xl',
          autoClose: 5000,
        }
      );
    };

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'queryUpdated' && event.query.queryKey[0] === 'badges') {
        const newBadge = event.query.state.data?.newBadge;
        if (newBadge) {
          handleNewBadge(newBadge);
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  return <ToastContainer position="top-right" />;
};

export default NotificationSystem;