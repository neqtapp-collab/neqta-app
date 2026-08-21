'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#11131A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        color: '#fff',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '16px',
          padding: '32px',
          background: '#171922',
        }}
      >
        <div
          style={{
            color: '#FFD84D',
            fontSize: '28px',
            fontWeight: 800,
            marginBottom: '32px',
          }}
        >
          NEQTA
        </div>

        <h1
          style={{
            fontSize: '28px',
            marginBottom: '8px',
          }}
        >
          Entrar
        </h1>

        <p
          style={{
            color: '#9CA3AF',
            marginBottom: '28px',
          }}
        >
          Acesse sua conta para continuar.
        </p>

        <form onSubmit={handleLogin}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
            }}
          >
            E-mail
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="voce@empresa.com"
            style={{
              width: '100%',
              padding: '13px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#11131A',
              color: '#fff',
              marginBottom: '20px',
              boxSizing: 'border-box',
            }}
          />

          <label
            style={{
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Senha
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            placeholder="Sua senha"
            style={{
              width: '100%',
              padding: '13px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#11131A',
              color: '#fff',
              marginBottom: '20px',
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <p
              style={{
                color: '#ff6565',
                marginBottom: '16px',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              border: 0,
              borderRadius: '8px',
              background: '#FFD84D',
              color: '#11131A',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}