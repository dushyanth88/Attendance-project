import { useEffect } from 'react';

/**
 * Custom hook to scroll to top when dependencies change
 * @param {*} dependencies - Array of dependencies to watch for changes
 * @param {boolean} enabled - Whether scroll should be enabled (default: true)
 * @param {string} behavior - Scroll behavior: 'smooth' or 'auto' (default: 'smooth')
 */
const useScrollToTop = (dependencies = [], enabled = true, behavior = 'smooth') => {
  useEffect(() => {
    if (enabled) {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: behavior
      });
    }
  }, dependencies);
};

export default useScrollToTop;
