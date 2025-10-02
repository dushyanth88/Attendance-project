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
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-black';
      case 'info':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed top-2 right-2 sm:top-4 sm:right-4 z-50 transform transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`${getToastStyles()} px-4 sm:px-6 py-3 sm:py-4 rounded-lg shadow-lg flex items-center space-x-2 sm:space-x-3 min-w-72 sm:min-w-80 max-w-sm sm:max-w-md`}>
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
