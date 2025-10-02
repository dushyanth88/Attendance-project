import { useState } from 'react';

const ApiTest = () => {
  const [testResult, setTestResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testApiConnection = async () => {
    setLoading(true);
    setTestResult('Testing API connection...');
    
    try {
      // Test health endpoint first
      const healthResponse = await fetch('/api/health');
      const healthData = await healthResponse.json();
      setTestResult(`Health check: ${JSON.stringify(healthData, null, 2)}`);
      
      // Test auth endpoint
      const authResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const authData = await authResponse.json();
      setTestResult(prev => prev + `\n\nAuth test: ${JSON.stringify(authData, null, 2)}`);
      
    } catch (error) {
      setTestResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testUserCreation = async () => {
    setLoading(true);
    setTestResult('Testing user creation...');
    
    try {
      const response = await fetch('/api/auth/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test@example.com',
          password: 'test123',
          role: 'faculty',
          department: 'CSE'
        })
      });
      
      const data = await response.json();
      setTestResult(`User creation test: ${JSON.stringify(data, null, 2)}`);
      
    } catch (error) {
      setTestResult(`User creation error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">API Test</h3>
      <div className="space-x-2 mb-4">
        <button
          onClick={testApiConnection}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Test API Connection
        </button>
        <button
          onClick={testUserCreation}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Test User Creation
        </button>
      </div>
      <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96">
        {testResult || 'Click a button to test...'}
      </pre>
    </div>
  );
};

export default ApiTest;
