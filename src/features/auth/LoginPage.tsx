import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    const action =
      mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })

    const { error: authError } = await action
    setSubmitting(false)

    if (authError) {
      setError(authError.message)
      return
    }

    setMessage(
      mode === 'login'
        ? 'Logged in successfully.'
        : 'Account created. If email verification is enabled, please verify your email.',
    )
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Staffing Profitability</h1>
        <p className="auth-subtitle">Sign in to manage multiple businesses under your account.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <span className="field-label">Password</span>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="btn-primary" disabled={submitting} type="submit" style={{ width: '100%', padding: '10px' }}>
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn-link" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>

        {message && <p className="toast success" style={{ marginTop: '1rem' }}>{message}</p>}
        {error && <p className="toast error" style={{ marginTop: '1rem' }}>{error}</p>}
      </div>
    </main>
  )
}
