import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface UseThemeReturn {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

/**
 * Theme management hook that handles light/dark mode switching
 * following Orchard9 design system principles.
 *
 * Features:
 * - Persists theme preference in localStorage
 * - Respects system preference when theme is 'system'
 * - Updates document data-theme attribute for CSS custom properties
 * - Provides toggle functionality for UI controls
 *
 * @returns {UseThemeReturn} Theme state and control functions
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage or default to system
    if (typeof window === 'undefined') return 'system'

    const stored = localStorage.getItem('orchard9-theme') as Theme
    return stored || 'system'
  })

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  // Resolved theme is what actually gets applied
  const resolvedTheme = theme === 'system' ? systemTheme : theme

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Update document data-theme attribute when resolved theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement

    // Remove existing theme attributes
    root.removeAttribute('data-theme')
    root.classList.remove('dark', 'light')

    // Set new theme
    if (resolvedTheme === 'dark') {
      root.setAttribute('data-theme', 'dark')
      root.classList.add('dark')
    } else {
      root.setAttribute('data-theme', 'light')
      root.classList.add('light')
    }
  }, [resolvedTheme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      if (newTheme === 'system') {
        localStorage.removeItem('orchard9-theme')
      } else {
        localStorage.setItem('orchard9-theme', newTheme)
      }
    }
  }

  const toggleTheme = () => {
    if (theme === 'system') {
      // If currently system, toggle to opposite of current system theme
      setTheme(systemTheme === 'dark' ? 'light' : 'dark')
    } else {
      // Toggle between light and dark
      setTheme(theme === 'dark' ? 'light' : 'dark')
    }
  }

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme
  }
}