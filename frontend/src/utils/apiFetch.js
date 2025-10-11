import axios from 'axios';

// Set base URL for API calls
const API_BASE_URL = 'http://localhost:5000';

export const apiFetch = async (options) => {
  const {
    url,
    method = 'GET',
    data,
    headers = {},
    responseType = 'json'
  } = options;

  // Automatically add Authorization header if access token exists
  const accessToken = localStorage.getItem('accessToken');
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  // Ensure full URL is used
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  try {
    const res = await axios({ 
      url: fullUrl, 
      method, 
      data, 
      headers, 
      responseType 
    });
    return res;
  } catch (error) {
    console.error('API Fetch Error:', error);
    
    // If unauthorized, try refresh flow
    const status = error?.response?.status;
    if (status === 401 && localStorage.getItem('refreshToken')) {
      try {
        const refreshRes = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { 
          refreshToken: localStorage.getItem('refreshToken') 
        });
        const newAccess = refreshRes.data?.accessToken;
        if (newAccess) {
          localStorage.setItem('accessToken', newAccess);
          headers.Authorization = `Bearer ${newAccess}`;
          // retry with new token
          const retry = await axios({ 
            url: fullUrl, 
            method, 
            data, 
            headers, 
            responseType 
          });
          return retry;
        }
      } catch (e) {
        console.error('Token refresh failed:', e);
        // fallthrough; let caller handle
      }
    }
    throw error;
  }
};




