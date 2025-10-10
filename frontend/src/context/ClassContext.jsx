import { createContext, useState, useContext, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';

const ClassContext = createContext();

export const ClassProvider = ({ children }) => {
  const [activeClass, setActiveClass] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all assigned classes for the faculty
  const fetchAssignedClasses = useCallback(async (facultyId) => {
    if (!facultyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiFetch({
        url: `/api/class-assignment/faculty/${facultyId}`,
        method: 'GET'
      });

      if (response.data.status === 'success') {
        const classes = response.data.data.assignments || [];
        setAssignedClasses(classes);
        
        // Auto-select first class if none selected and classes are available
        if (classes.length > 0 && !activeClass) {
          setActiveClass(classes[0]);
        }
        
        return classes;
      } else {
        throw new Error(response.data.message || 'Failed to fetch assigned classes');
      }
    } catch (error) {
      console.error('Error fetching assigned classes:', error);
      setError(error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [activeClass]);

  // Switch to a different class
  const switchClass = useCallback((classData) => {
    setActiveClass(classData);
  }, []);

  // Get class display name
  const getClassDisplayName = useCallback((classData) => {
    if (!classData) return '';
    return `${classData.year} | Semester ${classData.semester} | Section ${classData.section}`;
  }, []);

  // Get class key for unique identification
  const getClassKey = useCallback((classData) => {
    if (!classData) return '';
    return `${classData.batch}-${classData.year}-${classData.semester}-${classData.section}`;
  }, []);

  // Check if faculty has any assigned classes
  const hasAssignedClasses = useCallback(() => {
    return assignedClasses.length > 0;
  }, [assignedClasses]);

  // Get class info for API calls
  const getClassInfo = useCallback(() => {
    if (!activeClass) return null;
    return {
      batch: activeClass.batch,
      year: activeClass.year,
      semester: activeClass.semester,
      section: activeClass.section,
      facultyId: activeClass.facultyId,
      department: activeClass.department // Add department for bulk upload
    };
  }, [activeClass]);

  // Refresh assigned classes
  const refreshClasses = useCallback(async (facultyId) => {
    return await fetchAssignedClasses(facultyId);
  }, [fetchAssignedClasses]);

  const value = {
    // State
    activeClass,
    assignedClasses,
    loading,
    error,
    
    // Actions
    setActiveClass,
    switchClass,
    fetchAssignedClasses,
    refreshClasses,
    
    // Utilities
    getClassDisplayName,
    getClassKey,
    hasAssignedClasses,
    getClassInfo
  };

  return (
    <ClassContext.Provider value={value}>
      {children}
    </ClassContext.Provider>
  );
};

export const useClass = () => {
  const context = useContext(ClassContext);
  if (!context) {
    throw new Error('useClass must be used within a ClassProvider');
  }
  return context;
};

export default ClassContext;