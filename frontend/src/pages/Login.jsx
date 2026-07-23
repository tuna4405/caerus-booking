// Route: /login — POST /auth/login via AuthContext#login
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Card from '../components/ui/Card.jsx';
import TextField from '../components/ui/TextField.jsx';
import Button from '../components/ui/Button.jsx';
import FormError from '../components/ui/FormError.jsx';
import './Login.css';

// Map the API error to a friendly message by code — never render err.message raw.
function messageFor(err) {
  if (err instanceof ApiError) {
    if (err.code === 'UNAUTHORIZED') return 'Incorrect email or password.';
    if (err.code === 'VALIDATION_ERROR') return 'Please check the form.';
  }
  return 'Something went wrong. Please try again.';
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="caerus-login">
      <Card className="caerus-login-card">
        <h1 className="caerus-login-title">Log in</h1>

        <form className="caerus-login-form" onSubmit={handleSubmit} noValidate>
          <FormError>{error}</FormError>

          <TextField
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            id="login-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="caerus-login-alt">
          Need an account? <Link to="/register">Register</Link>
        </p>
      </Card>
    </main>
  );
}
