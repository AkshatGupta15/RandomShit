'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock, User, Shield, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PNBLogo } from '@/components/icons/pnb-logo'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'

export function LoginForm() {
  const { login, verifyTwoFactor } = useAuth()
  const isDemoMode = api.isDemoMode()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [otpHint, setOtpHint] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginStep, setLoginStep] = useState<'credentials' | 'otp'>('credentials')

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const result = await login(username, password)
      if (result.requires_2fa && result.challenge_id) {
        setChallengeId(result.challenge_id)
        setOtpHint(result.otp_hint ?? null)
        setLoginStep('otp')
        return
      }
    } catch (err) {
      setError('Invalid credentials. Please try again.')
      console.error('Login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (!challengeId) {
        throw new Error('Missing challenge')
      }
      await verifyTwoFactor(challengeId, otp)
    } catch (err) {
      setError('Invalid or expired OTP. Please try again.')
      console.error('2FA verification error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const goBackToCredentials = () => {
    setLoginStep('credentials')
    setChallengeId(null)
    setOtp('')
    setOtpHint(null)
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.85 0.15 85 / 0.3) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.85 0.15 85 / 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-pnb-gold/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
        
        {/* Gradient orbs */}
        <div 
          className="absolute top-1/4 -left-20 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, oklch(0.35 0.12 15), transparent)' }}
        />
        <div 
          className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'radial-gradient(circle, oklch(0.85 0.15 85), transparent)' }}
        />
      </div>

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="glass rounded-2xl p-8 border border-pnb-maroon/30 shadow-2xl">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center mb-8"
          >
            <PNBLogo />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Secure Access
            </h1>
            <p className="text-sm text-muted-foreground">
              Enterprise Attack Surface Management
            </p>
          </motion.div>

          {/* Demo mode notice */}
          {isDemoMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-3 rounded-lg bg-pnb-gold/10 border border-pnb-gold/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-pnb-gold shrink-0" />
                <span className="text-sm font-medium text-pnb-gold">Demo Mode</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Use credentials: <code className="px-1 py-0.5 rounded bg-secondary text-pnb-gold">admin</code> / <code className="px-1 py-0.5 rounded bg-secondary text-pnb-gold">admin123</code>
              </p>
            </motion.div>
          )}

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2"
            >
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={loginStep === 'credentials' ? handleCredentialsSubmit : handleOtpSubmit} className="space-y-5">
            {loginStep === 'credentials' ? (
              <>
                {/* Username */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 h-12 bg-secondary/50 border-border/50 focus:border-pnb-gold focus:ring-pnb-gold/20"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </motion.div>

                {/* Password */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-secondary/50 border-border/50 focus:border-pnb-gold focus:ring-pnb-gold/20"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="pl-10 h-12 bg-secondary/50 border-border/50 focus:border-pnb-gold focus:ring-pnb-gold/20 tracking-[0.3em] font-mono"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </motion.div>

                {otpHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-pnb-gold/30 bg-pnb-gold/10 px-3 py-2"
                  >
                    <p className="text-xs text-pnb-gold">Dev OTP: <span className="font-mono tracking-wider">{otpHint}</span></p>
                  </motion.div>
                )}

                <button
                  type="button"
                  onClick={goBackToCredentials}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  Back to username/password
                </button>
              </>
            )}

            {/* Submit button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                type="submit"
                className={cn(
                  'w-full h-12 text-base font-semibold',
                  'bg-pnb-maroon hover:bg-pnb-maroon-dark',
                  'border border-pnb-gold/30 hover:border-pnb-gold/50',
                  'transition-all duration-300',
                  'glow-maroon hover:glow-gold'
                )}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-5 w-5" />
                    Authenticating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {loginStep === 'credentials' ? 'Access System' : 'Verify OTP'}
                  </span>
                )}
              </Button>
            </motion.div>
          </form>

          {/* Security notice */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 pt-6 border-t border-border/30"
          >
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>256-bit SSL Encrypted Connection</span>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-muted-foreground mt-6"
        >
          Punjab National Bank - PNB Quantum Shield v1.0
        </motion.p>
      </motion.div>
    </div>
  )
}
