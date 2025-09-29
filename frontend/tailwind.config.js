/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        black: '#000000',
        white: '#FFFFFF',
        // Orchard brand colors - exposed as Tailwind utilities
        'orchard-orange': '#FB923C',
        'orchard-orange-light': '#FED7AA',
        'orchard-orange-dark': '#EA580C',
        orchard: {
          // Dark theme colors
          'black': '#000000',
          'deep-blue': '#0A1628',
          'blue-gray': '#1E293B',
          'slate': '#334155',
          'gray': '#64748B',
          'light-gray': '#94A3B8',
          'off-white': '#F8FAFC',
          'pure-white': '#FFFFFF',
          // Light theme colors
          'light-blue': '#F0F4F8',
          'blue-tint': '#E2E8F0',
          'cool-gray': '#CBD5E1',
          'dark-gray': '#475569',
          'charcoal': '#334155',
          'deep-slate': '#1E293B',
          // Brand colors
          'orange': '#FB923C',
          'orange-light': '#FED7AA',
          'orange-dark': '#EA580C'
        },
        status: {
          success: '#10B981',
          'success-bg': '#ECFDF5',
          warning: '#F59E0B',
          'warning-bg': '#FFFBEB',
          error: '#EF4444',
          'error-bg': '#FEF2F2',
          info: '#3B82F6',
          'info-bg': '#EFF6FF'
        },
        // Theme-aware semantic colors using CSS custom properties
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)'
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          emphasis: 'var(--text-emphasis)'
        },
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)'
        }
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          '-apple-system',
          'BlinkMacSystemFont',
          'Helvetica Neue',
          'Segoe UI',
          'Roboto',
          'Arial',
          'sans-serif'
        ],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'Cascadia Code', 'monospace']
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.025em' }],    // 12px
        'sm': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.015em' }],   // 14px
        'base': ['1rem', { lineHeight: '1.4', letterSpacing: '0.01em' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.4', letterSpacing: '0.005em' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.3', letterSpacing: '0em' }],        // 20px
        '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.005em' }],   // 24px
        '3xl': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.015em' }],  // 36px
        '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }]       // 48px
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      spacing: {
        '0': '0',
        '1': '0.25rem',   // 4px
        '2': '0.5rem',    // 8px
        '3': '0.75rem',   // 12px
        '4': '1rem',      // 16px
        '5': '1.25rem',   // 20px
        '6': '1.5rem',    // 24px
        '8': '2rem',      // 32px
        '10': '2.5rem',   // 40px
        '12': '3rem',     // 48px
        '16': '4rem',     // 64px
        '20': '5rem',     // 80px
        '24': '6rem'      // 96px
      },
      borderRadius: {
        'none': '0',
        'sm': '2px',
        'DEFAULT': '4px',
        'lg': '8px'
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'none': '0 0 #0000'
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms'
      },
      transitionTimingFunction: {
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out': 'cubic-bezier(0, 0, 0.2, 1)',
        'in': 'cubic-bezier(0.4, 0, 1, 1)'
      },
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px'
      },
      maxWidth: {
        'container': '1280px'
      },
      // Add container as utility class
      width: {
        'container': '1280px'
      }
    },
  },
  plugins: [],
}