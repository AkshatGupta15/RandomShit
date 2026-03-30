'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { api } from '@/lib/api'

interface User {
  id: number
  username: string
  role: string
  email?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isDemoMode: boolean
  login: (username: string, password: string) => Promise<{ requires_2fa?: boolean; challenge_id?: string; otp_hint?: string }>
  verifyTwoFactor: (challengeId: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isDemoMode = api.isDemoMode()

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // In demo mode, check localStorage
      if (isDemoMode && typeof window !== 'undefined') {
        const stored = localStorage.getItem('pnb_demo_user')
        if (stored) {
          setUser(JSON.parse(stored))
          return
        }
      }
      
      const data = await api.getSession()
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [isDemoMode])

  const login = async (username: string, password: string) => {
    const data = await api.login(username, password)

    if (data?.requires_2fa) {
      return {
        requires_2fa: true,
        challenge_id: data.challenge_id,
        otp_hint: data.otp_hint,
      }
    }
    
    // In demo mode, store in localStorage
    if (isDemoMode && typeof window !== 'undefined' && data?.user) {
      localStorage.setItem('pnb_demo_user', JSON.stringify(data.user))
    }

    if (data?.user) {
      setUser(data.user)
    }

    return {}
  }

  const verifyTwoFactor = async (challengeId: string, otp: string) => {
    const data = await api.verify2FA(challengeId, otp)

    if (isDemoMode && typeof window !== 'undefined' && data?.user) {
      localStorage.setItem('pnb_demo_user', JSON.stringify(data.user))
    }

    if (data?.user) {
      setUser(data.user)
    }
  }

  const logout = async () => {
    await api.logout()
    
    // In demo mode, clear localStorage
    if (isDemoMode && typeof window !== 'undefined') {
      localStorage.removeItem('pnb_demo_user')
    }
    
    setUser(null)
  }

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isDemoMode,
        login,
        verifyTwoFactor,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
