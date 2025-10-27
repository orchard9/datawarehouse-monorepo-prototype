import React from 'react'
import { Database, Menu, Sun, Moon, BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

interface LayoutProps {
  children: React.ReactNode
}

/**
 * Layout component following Orchard9 design principles:
 * - Nike-inspired minimalism
 * - Purposeful sidebar navigation
 * - Clean, functional design
 * - Accessibility-first approach
 * - Responsive design: collapsed on mobile, expanded on desktop
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false) // Start collapsed on mobile
  const location = useLocation()
  const { resolvedTheme, toggleTheme } = useTheme()

  const navigation = [
    { name: 'Overview', href: '/', icon: BarChart3, ariaLabel: 'View performance overview' },
    { name: 'Campaigns', href: '/campaigns', icon: Database, ariaLabel: 'View campaigns' },
  ]

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--surface-primary)' }}>
      {/* Sidebar - Nike-inspired minimal design, responsive */}
      <aside
        className={`
          w-64 transition-all duration-250 flex-shrink-0
          ${sidebarOpen ? 'block' : 'hidden'} lg:block
        `}
        role="navigation"
        aria-label="Main navigation"
        style={{
          backgroundColor: 'var(--surface-secondary)',
          borderRight: '1px solid var(--border-subtle)'
        }}
      >
        <div className="flex h-full flex-col">
          {/* Brand header */}
          <div className="flex h-16 items-center px-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h1 className="font-bold text-xl tracking-tight" style={{ color: 'var(--content-primary)' }}>
              Orchard9
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-6" role="list">
            <ul className="space-y-1" role="none">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                return (
                  <li key={item.name} role="none">
                    <Link
                      to={item.href}
                      className="group flex items-center px-3 py-3 text-sm font-medium transition-all duration-150 border-l-2"
                      style={{
                        color: isActive ? 'var(--content-inverse)' : 'var(--content-secondary)',
                        backgroundColor: isActive ? 'var(--interactive-default)' : 'transparent',
                        borderLeftColor: isActive ? 'var(--interactive-hover)' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--content-primary)'
                          e.currentTarget.style.backgroundColor = 'var(--surface-tertiary)'
                          e.currentTarget.style.borderLeftColor = 'var(--border-default)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.color = 'var(--content-secondary)'
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.borderLeftColor = 'transparent'
                        }
                      }}
                      aria-label={item.ariaLabel}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon
                        className="mr-3 h-5 w-5 transition-colors duration-150"
                        aria-hidden="true"
                      />
                      <span className="font-medium tracking-wide">{item.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Theme toggle - positioned at bottom */}
          <div className="px-2 pb-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center p-3 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              style={{
                color: 'var(--content-secondary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--content-primary)'
                e.currentTarget.style.backgroundColor = 'var(--surface-tertiary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--content-secondary)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {resolvedTheme === 'dark' ? (
                <Sun size={20} aria-hidden="true" />
              ) : (
                <Moon size={20} aria-hidden="true" />
              )}
              <span className="ml-3 font-medium tracking-wide">
                {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile header - only visible on mobile */}
        <header
          className="lg:hidden px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: 'var(--surface-elevated)',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <h1 className="font-bold text-lg tracking-tight" style={{ color: 'var(--content-primary)' }}>
            Orchard9
          </h1>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
            style={{ color: 'var(--content-secondary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--content-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--content-secondary)'
            }}
            aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={sidebarOpen}
          >
            <Menu size={20} />
          </button>
        </header>

        {/* Main content - no header, let pages handle their own */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-primary)' }}
          role="main"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout