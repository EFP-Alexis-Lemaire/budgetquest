import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const Toast = ({ message, duration = 3000, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg flex items-center space-x-2">
      <span>{message}</span>
      <button onClick={onClose} className="text-gray-400 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, duration) => {
    const id = Date.now();
    setToasts((prevToasts) => [...prevToasts, { id, message, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  };

  return (
    <div>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ToastContainer;

// Usage example in another component
import ToastContainer from './components/ToastContainer';

function SomeComponent() {
  const toastRef = useRef();

  const handleAction = () => {
    toastRef.current.addToast('You gained XP!', 3000);
  };

  return (
    <div>
      <button onClick={handleAction} className="btn-primary">
        Gain XP
      </button>
      <ToastContainer ref={toastRef} />
    </div>
  );
}