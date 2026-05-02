import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Lock, Globe, Loader, LogIn, UserPlus, ArrowLeft } from 'lucide-react';
import '../styles/AuthPages.css';

export function LoginPage() {
  const [showRegister, setShowRegister] = useState(false);
  
  // Login form state
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });
  
  // Register form state
  const [registerData, setRegisterData] = useState({
    username: '',
    password: '',
    homePlanet: 'Earth',
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const planets = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      setTimeout(() => setSuccess(''), 5000);
    }
  }, [location]);

  // LOGIN HANDLERS
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    if (!loginData.username.trim()) {
      setError('Username is required');
      return;
    }
    if (!loginData.password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://kronos-production-c81f.up.railway.app/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: loginData.username.trim(),
          password: loginData.password,
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

  // REGISTER HANDLERS
  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!registerData.username.trim() || registerData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!registerData.password || registerData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }




    setLoading(true);

    try {
      const response = await fetch('https://kronos-production-c81f.up.railway.app/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerData.username.trim(),
          password: registerData.password,
          home_planet: registerData.homePlanet,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        setShowRegister(false);
        setRegisterData({
          username: '',
          password: '',
          
          homePlanet: 'Earth',
        });
        setLoginData({
          username: registerData.username,
          password: '',
        });
      }, 1500);

    } catch (err) {
      setError('Failed to connect to server: ' + err.message);
      setLoading(false);
    }
  };

  const handleDemoLogin = async (username, password) => {
    setLoginData({ username, password });
    setLoading(true);

    try {
      const response = await fetch('https://kronos-production-c81f.up.railway.app/api/login', {
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
  };

  return (
    <div className="auth-container">
      <div className={`auth-card ${showRegister ? 'show-register' : ''}`}>
        {/* LOGIN FORM */}
        <form className="auth-form login-form" onSubmit={handleLoginSubmit}>
          <section>
            <h2 className="auth-title">
              <LogIn size={24} style={{ marginRight: '8px' }} />
              Kronos Login
            </h2>

            {success && <div className="success-message">{success}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="login-username">
                <User size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Username
              </label>
              <input
                type="text"
                id="login-username"
                name="username"
                value={loginData.username}
                onChange={handleLoginChange}
                placeholder="Enter your username"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">
                <Lock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Password
              </label>
              <input
                type="password"
                id="login-password"
                name="password"
                value={loginData.password}
                onChange={handleLoginChange}
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader size={16} className="spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>

            <div className="demo-section">
              <p className="demo-label">Demo Accounts</p>
              <div className="demo-buttons">
                <button
                  type="button"
                  className="demo-button"
                  onClick={() => handleDemoLogin('alice', 'password123')}
                  disabled={loading}
                >
                  <User size={14} />
                  Alice (Mars)
                </button>
                <button
                  type="button"
                  className="demo-button"
                  onClick={() => handleDemoLogin('bob', 'password123')}
                  disabled={loading}
                >
                  <User size={14} />
                  Bob (Jupiter )
                </button>
              </div>
            </div>

            <div className="auth-footer">
              <p>
                Don't have an account?{' '}
                <a onClick={() => setShowRegister(true)}>Register here</a>
              </p>
            </div>
          </section>
        </form>

        {/* REGISTER FORM */}
        <form className="auth-form register-form" onSubmit={handleRegisterSubmit}>
          <section>
            <h2 className="auth-title">
              <UserPlus size={24} style={{ marginRight: '8px' }} />
              Create Account
            </h2>

            {success && <div className="success-message">{success}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label htmlFor="register-username">
                <User size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Username
              </label>
              <input
                type="text"
                id="register-username"
                name="username"
                value={registerData.username}
                onChange={handleRegisterChange}
                placeholder="Choose a username (3+ chars)"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="register-password">
                <Lock size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Password
              </label>
              <input
                type="password"
                id="register-password"
                name="password"
                value={registerData.password}
                onChange={handleRegisterChange}
                placeholder="Create a password (8+ chars)"
                disabled={loading}
              />
            </div>



            <div className="form-group">
              <label htmlFor="register-planet">
                <Globe size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Home Planet
              </label>
              <select
                id="register-planet"
                name="homePlanet"
                value={registerData.homePlanet}
                onChange={handleRegisterChange}
                disabled={loading}
              >
                {planets.map(planet => (
                  <option key={planet} value={planet}>{planet}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader size={16} className="spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Register
                </>
              )}
            </button>

            <div className="auth-footer">
              <p>
                Already have an account?{' '}
                <a onClick={() => setShowRegister(false)}>Sign in here</a>
              </p>
            </div>
          </section>
        </form>

        {/* TOGGLE BUTTON */}
        <div className="auth-toggle">
          <h6>
            <span className={!showRegister ? 'active' : ''}>Login</span>
            <span className={showRegister ? 'active' : ''}>Signup</span>
          </h6>
          <label className="auth-toggle-label" onClick={() => setShowRegister(!showRegister)}>
            <ArrowLeft size={14} />
          </label>
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
