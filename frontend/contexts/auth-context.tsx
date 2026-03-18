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
  login: (username: string, password: string) => Promise<void>
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
    
    // In demo mode, store in localStorage
    if (isDemoMode && typeof window !== 'undefined') {
      localStorage.setItem('pnb_demo_user', JSON.stringify(data.user))
    }
    
    setUser(data.user)
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
