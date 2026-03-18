'use client'

import { useState, useEffect, useRef } from 'react'

interface UseAnimatedCounterOptions {
  duration?: number
  delay?: number
  easing?: (t: number) => number
}

const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

export function useAnimatedCounter(
  end: number,
  options: UseAnimatedCounterOptions = {}
): number {
  const { duration = 2000, delay = 0, easing = easeOutExpo } = options
  const [count, setCount] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const startAnimation = () => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) {
          startTimeRef.current = timestamp
        }

        const elapsed = timestamp - startTimeRef.current
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easing(progress)
        
        setCount(Math.floor(easedProgress * end))

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate)
        } else {
          setCount(end)
        }
      }

      frameRef.current = requestAnimationFrame(animate)
    }

    const timeoutId = setTimeout(startAnimation, delay)

    return () => {
      clearTimeout(timeoutId)
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [end, duration, delay, easing])

  return count
}
