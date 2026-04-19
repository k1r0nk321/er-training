'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { User, AuthState } from './types'

const AuthContext = createContext<AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  enterTrialMode: () => void
}>({
  user: null,
  isLoading: true,
  isTrialMode: false,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  enterTrialMode: () => {}
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTrialMode, setIsTrialMode] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('trial_mode')
    if (stored === 'true') setIsTrialMode(true)

    const storedUser = sessionStorage.getItem('auth_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single()

      if (error || !data) return { error: 'メールアドレスまたはパスワードが違います' }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) return { error: 'メールアドレスまたはパスワードが違います' }

      setUser(data)
      sessionStorage.setItem('auth_user', JSON.stringify(data))
      return { error: null }
    } catch {
      return { error: 'ログインに失敗しました' }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsTrialMode(false)
    sessionStorage.removeItem('auth_user')
    sessionStorage.removeItem('trial_mode')
  }

  const enterTrialMode = () => {
    setIsTrialMode(true)
    sessionStorage.setItem('trial_mode', 'true')
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isTrialMode, signIn, signOut, enterTrialMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
