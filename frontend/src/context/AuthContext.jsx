import { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

// Set axios base URL
axios.defaults.baseURL = 'http://localhost:5000';

const AuthContext = createContext();

const initialState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: false,
  loading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    case 'LOGIN_FAIL':
    case 'LOGOUT':
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    case 'UPDATE_TOKENS':
      localStorage.setItem('accessToken', action.payload.accessToken);
      return {
        ...state,
        accessToken: action.payload.accessToken
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set axios default header
  useEffect(() => {
    if (state.accessToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [state.accessToken]);

  // Load user on app start - only run once
  useEffect(() => {
    const loadUser = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (accessToken) {
        try {
          console.log('Loading user with access token');
          const res = await axios.get('/api/auth/me');
          console.log('User loaded successfully:', res.data.user);
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { 
              accessToken, 
              refreshToken, 
              user: res.data.user 
            }
          });
        } catch (error) {
          console.error('Error loading user:', error.response?.data || error.message);
          
          // Try to refresh token if access token expired
          if (error.response?.status === 401 && refreshToken) {
            try {
              const refreshRes = await axios.post('/api/auth/refresh', {
                refreshToken
              });
              
              dispatch({
                type: 'UPDATE_TOKENS',
                payload: { accessToken: refreshRes.data.accessToken }
              });
              
              // Retry loading user
              const userRes = await axios.get('/api/auth/me');
              dispatch({
                type: 'LOGIN_SUCCESS',
                payload: { 
                  accessToken: refreshRes.data.accessToken, 
                  refreshToken, 
                  user: userRes.data.user 
                }
              });
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              dispatch({ type: 'LOGOUT', payload: 'Session expired' });
            }
          } else {
            dispatch({ type: 'LOGOUT', payload: 'Authentication failed' });
          }
        }
      } else {
        console.log('No access token found, setting loading to false');
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadUser();
  }, []); // Empty dependency array - only run once on mount

  const login = async (email, password, role) => {
    try {
      console.log('🔐 Frontend: Attempting login with:', { email, role });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const loginData = { 
        email: email.toLowerCase().trim(), 
        password, 
        role: role.toLowerCase().trim() 
      };
      
      console.log('📤 Frontend: Sending login request:', loginData);
      
      const res = await axios.post('/api/auth/login', loginData);
      console.log('✅ Frontend: Login successful:', res.data);
      
      if (res.data.success) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            user: res.data.user
          }
        });
      } else {
        throw new Error(res.data.msg || 'Login failed');
      }
      
      return { success: true };
    } catch (error) {
      console.error('❌ Frontend: Login error:', error.response?.data || error.message);
      
      // Handle specific error messages from backend
      let message = 'Login failed';
      
      if (error.response?.data?.msg) {
        message = error.response.data.msg;
      } else if (error.response?.status === 401) {
        message = 'Invalid credentials';
      } else if (error.response?.status === 400) {
        message = 'Validation failed. Please check your input.';
      } else if (error.response?.status === 500) {
        message = 'Server error. Please try again.';
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        message = 'Network error. Please check your connection.';
      }
      
      console.log('📝 Frontend: Error message to display:', message);
      
      dispatch({ type: 'LOGIN_FAIL', payload: message });
      return { success: false, error: message };
    }
  };

  const logout = () => {
    dispatch({ type: 'LOGOUT', payload: null });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value = {
    ...state,
    login,
    logout,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
