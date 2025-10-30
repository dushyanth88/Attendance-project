import { useState, useEffect } from 'react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg';
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg';
      case 'info':
        return 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed top-16 right-2 sm:top-20 sm:right-4 z-[9999] transform transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`${getToastStyles()} px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-xl flex items-center space-x-2 sm:space-x-3 min-w-72 sm:min-w-80 max-w-sm sm:max-w-md border border-white border-opacity-20 backdrop-blur-sm`}>
        <span className="text-lg sm:text-xl font-bold flex-shrink-0">{getIcon()}</span>
        <span className="flex-1 text-sm sm:text-base break-words">{message}</span>
        <button
          onClick={handleClose}
          className="text-white hover:text-gray-200 text-lg sm:text-xl font-bold flex-shrink-0 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
