// Route: /register — POST /auth/register via AuthContext#register
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import Card from '../components/ui/Card.jsx';
import TextField from '../components/ui/TextField.jsx';
import Button from '../components/ui/Button.jsx';
import FormError from '../components/ui/FormError.jsx';
import './Register.css';

const MIN_PASSWORD = 8; // mirrors the API's rule (api-spec §3.1) for early feedback

// Map the API error to a friendly message by code — never render err.message raw.
function messageFor(err) {
  if (err instanceof ApiError) {
    if (err.code === 'EMAIL_ALREADY_EXISTS') return 'That email is already registered.';
    if (err.code === 'VALIDATION_ERROR') return 'Please check the form.';
  }
  return 'Something went wrong. Please try again.';
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    // Client-side check so a too-short password never leaves the browser.
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/'); // 201 -> logged in
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="caerus-register">
      <Card className="caerus-register-card">
        <h1 className="caerus-register-title">Create your account</h1>

        <form className="caerus-register-form" onSubmit={handleSubmit} noValidate>
          <FormError>{error}</FormError>

          <TextField
            id="register-name"
            label="Name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            id="register-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            id="register-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD}
            required
          />

          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="caerus-register-alt">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
