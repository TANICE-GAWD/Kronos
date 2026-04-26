import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, LogIn } from 'lucide-react';
import '../styles/AuthPages.css';

export function LoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    
    if (location.state?.message) {
      setSuccess(location.state.message);
      setTimeout(() => setSuccess(''), 5000);
    }
  }, [location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!formData.password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('username', data.username);
        localStorage.setItem('homePlanet', data.home_planet);

        console.log('✅ Login successful:', data);
        setSuccess(`Welcome back, ${data.username}!`);

        
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }

    } catch (err) {
      setError('Failed to connect to server: ' + err.message);
      setLoading(false);
    }
  };

  const handleDemoLogin = async (username, password) => {
    setFormData({ username, password });
    
    
    setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('http://localhost:8080/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Demo login failed');
          setLoading(false);
          return;
        }

        if (data.token) {
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('userId', data.user_id);
          localStorage.setItem('username', data.username);
          localStorage.setItem('homePlanet', data.home_planet);

          console.log('✅ Demo login successful');
          setSuccess(`Welcome, ${data.username}!`);

          setTimeout(() => {
            navigate('/');
          }, 1000);
        }
      } catch (err) {
        setError('Failed to connect to server: ' + err.message);
        setLoading(false);
      }
    }, 100);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">  Kronos Login</h1>
        <p className="auth-subtitle">Access your interplanetary wallet</p>

        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="demo-section">
          <p className="demo-label">Demo Accounts:</p>
          <div className="demo-buttons">
            <button
              type="button"
              className="demo-button"
              onClick={() => handleDemoLogin('alice', 'password123')}
              disabled={loading}
            >
              👨 Alice (Mars)
            </button>
            <button
              type="button"
              className="demo-button"
              onClick={() => handleDemoLogin('bob', 'password123')}
              disabled={loading}
            >
              👩 Bob (Earth)
            </button>
          </div>
          <small style={{ textAlign: 'center', marginTop: '10px', display: 'block' }}>
            Quick access to pre-created test accounts
          </small>
        </div>

        <div className="auth-footer">
          <p>Don't have an account? <a href="/register">Register here</a></p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
