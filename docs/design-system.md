# Orchard9 Design System
*Inspired by Nike's Minimalism & Dieter Rams' "Less but Better" Philosophy*

## Design Philosophy

### Core Principles
1. **Just Do It**: Every element serves a purpose
2. **Less but Better**: Eliminate unnecessary complexity
3. **Functional Beauty**: Form follows function with elegant execution
4. **Honest Design**: No decorative elements that don't enhance usability

### Visual Identity
- **Minimalist**: Clean lines, ample whitespace, purposeful elements
- **Athletic**: Sharp, confident, performance-oriented aesthetics
- **Accessible**: Universal design that works for everyone
- **Consistent**: Systematic approach to all design decisions

## Color System

### Primary Palette

#### Dark Theme (Default)
```css
--orchard-black: #000000;           /* Pure black - primary backgrounds */
--orchard-deep-blue: #0A1628;       /* Deep navy - secondary backgrounds */
--orchard-blue-gray: #1E293B;       /* Blue-gray - tertiary backgrounds */
--orchard-slate: #334155;           /* Medium slate - borders, dividers */
--orchard-gray: #64748B;            /* Text secondary */
--orchard-light-gray: #94A3B8;      /* Text muted */
--orchard-off-white: #F8FAFC;       /* Text primary */
--orchard-pure-white: #FFFFFF;      /* Text emphasis */
```

#### Light Theme
```css
--orchard-pure-white: #FFFFFF;      /* Pure white - primary backgrounds */
--orchard-light-blue: #F0F4F8;      /* Light blue - secondary backgrounds */
--orchard-blue-tint: #E2E8F0;       /* Blue tint - tertiary backgrounds */
--orchard-cool-gray: #CBD5E1;       /* Cool gray - borders, dividers */
--orchard-dark-gray: #475569;       /* Text secondary */
--orchard-charcoal: #334155;        /* Text muted */
--orchard-deep-slate: #1E293B;      /* Text primary */
--orchard-black: #000000;           /* Text emphasis */
```

### Semantic Colors

#### Status Colors (Theme Agnostic)
```css
--orchard-success: #10B981;         /* Success states */
--orchard-success-bg: #ECFDF5;      /* Success backgrounds */
--orchard-warning: #F59E0B;         /* Warning states */
--orchard-warning-bg: #FFFBEB;      /* Warning backgrounds */
--orchard-error: #EF4444;           /* Error states */
--orchard-error-bg: #FEF2F2;        /* Error backgrounds */
--orchard-info: #3B82F6;            /* Info states */
--orchard-info-bg: #EFF6FF;         /* Info backgrounds */
```

#### Brand Accent
```css
--orchard-orange: #FB923C;          /* Primary brand color */
--orchard-orange-light: #FED7AA;    /* Light brand tint */
--orchard-orange-dark: #EA580C;     /* Dark brand shade */
```

## Typography

### Font Stack
```css
--font-primary: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
```

### Type Scale (Modular Scale: 1.250 - Major Third)
```css
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
--text-5xl: 3rem;       /* 48px */
```

### Font Weights
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Line Heights
```css
--leading-tight: 1.25;    /* Headlines */
--leading-normal: 1.5;    /* Body text */
--leading-relaxed: 1.625; /* Reading content */
```

## Spacing System

### Scale (Base: 4px)
```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

## Component System

### Buttons

#### Primary Button
```css
.btn-primary {
  background: var(--orchard-black);
  color: var(--orchard-pure-white);
  padding: var(--space-3) var(--space-6);
  border: 1px solid var(--orchard-black);
  border-radius: 0;
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  letter-spacing: 0.025em;
  text-transform: uppercase;
  transition: all 150ms ease;
}

.btn-primary:hover {
  background: var(--orchard-pure-white);
  color: var(--orchard-black);
}

.btn-primary:focus {
  outline: 2px solid var(--orchard-orange);
  outline-offset: 2px;
}
```

#### Secondary Button
```css
.btn-secondary {
  background: transparent;
  color: var(--orchard-black);
  border: 1px solid var(--orchard-black);
  /* Same padding, typography as primary */
}

.btn-secondary:hover {
  background: var(--orchard-black);
  color: var(--orchard-pure-white);
}
```

### Cards

#### Minimal Card
```css
.card {
  background: var(--orchard-pure-white);
  border: 1px solid var(--orchard-cool-gray);
  padding: var(--space-6);
  transition: border-color 150ms ease;
}

.card:hover {
  border-color: var(--orchard-black);
}

.card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
  color: var(--orchard-black);
}

.card-content {
  color: var(--orchard-dark-gray);
  line-height: var(--leading-normal);
}
```

### Status Indicators

#### Status Badge
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: 2px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-active {
  background: var(--orchard-success-bg);
  color: var(--orchard-success);
}

.status-inactive {
  background: var(--orchard-cool-gray);
  color: var(--orchard-charcoal);
}
```

## Layout Principles

### Grid System
- **Base Grid**: 8px grid for all elements
- **Container Max Width**: 1280px
- **Gutter**: 24px (--space-6)
- **Breakpoints**:
  - sm: 640px
  - md: 768px
  - lg: 1024px
  - xl: 1280px

### Whitespace Rules
1. **Breathing Room**: Minimum 24px between major sections
2. **Content Hierarchy**: Use whitespace to create visual hierarchy
3. **Edge Space**: Consistent padding on container edges
4. **Vertical Rhythm**: Consistent line-height and margin relationships

## Accessibility Standards

### Color Contrast
- **AA Compliant**: Minimum 4.5:1 contrast ratio for normal text
- **AAA Target**: 7:1 contrast ratio for optimal readability
- **Large Text**: Minimum 3:1 contrast ratio

### Focus Management
```css
.focus-outline {
  outline: 2px solid var(--orchard-orange);
  outline-offset: 2px;
}
```

### Semantic HTML
- Use proper heading hierarchy (h1-h6)
- Include ARIA labels for interactive elements
- Provide alt text for all images
- Use semantic landmarks (nav, main, aside, footer)

## Animation Principles

### Timing
```css
--timing-fast: 150ms;     /* Micro-interactions */
--timing-normal: 250ms;   /* Standard transitions */
--timing-slow: 350ms;     /* Complex animations */
```

### Easing
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
```

### Performance Rules
1. Only animate `transform` and `opacity` properties
2. Use `will-change` sparingly and remove after animation
3. Prefer CSS transitions over JavaScript animations
4. Respect `prefers-reduced-motion`

## Implementation Guidelines

### CSS Custom Properties Setup
```css
:root {
  /* Light theme by default */
  --bg-primary: var(--orchard-pure-white);
  --bg-secondary: var(--orchard-light-blue);
  --text-primary: var(--orchard-deep-slate);
  --text-secondary: var(--orchard-dark-gray);
}

[data-theme="dark"] {
  --bg-primary: var(--orchard-black);
  --bg-secondary: var(--orchard-deep-blue);
  --text-primary: var(--orchard-off-white);
  --text-secondary: var(--orchard-gray);
}
```

### Tailwind Configuration
```js
module.exports = {
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000000',
      white: '#FFFFFF',
      orchard: {
        'deep-blue': '#0A1628',
        'blue-gray': '#1E293B',
        'slate': '#334155',
        'gray': '#64748B',
        'light-gray': '#94A3B8',
        'off-white': '#F8FAFC',
        'orange': '#FB923C',
        'orange-light': '#FED7AA',
        'orange-dark': '#EA580C'
      },
      status: {
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6'
      }
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['SF Mono', 'Monaco', 'Cascadia Code', 'monospace']
    },
    spacing: {
      '0': '0',
      '1': '0.25rem',
      '2': '0.5rem',
      '3': '0.75rem',
      '4': '1rem',
      '5': '1.25rem',
      '6': '1.5rem',
      '8': '2rem',
      '10': '2.5rem',
      '12': '3rem',
      '16': '4rem',
      '20': '5rem',
      '24': '6rem'
    }
  }
}
```

## Design Tokens Export

### JSON Format (for Design Tools)
```json
{
  "color": {
    "primary": {
      "black": "#000000",
      "white": "#FFFFFF",
      "orange": "#FB923C"
    },
    "neutral": {
      "50": "#F8FAFC",
      "100": "#F1F5F9",
      "200": "#E2E8F0",
      "300": "#CBD5E1",
      "400": "#94A3B8",
      "500": "#64748B",
      "600": "#475569",
      "700": "#334155",
      "800": "#1E293B",
      "900": "#0A1628"
    }
  }
}
```

## Component Library Structure

```
src/
├── components/
│   ├── base/           # Atomic components
│   │   ├── Button/
│   │   ├── Input/
│   │   └── Badge/
│   ├── layout/         # Layout components
│   │   ├── Container/
│   │   ├── Grid/
│   │   └── Stack/
│   └── patterns/       # Composed components
│       ├── Card/
│       ├── DataTable/
│       └── Navigation/
├── styles/
│   ├── tokens.css      # Design tokens
│   ├── components.css  # Component styles
│   └── utilities.css   # Utility classes
└── types/
    └── theme.ts        # TypeScript theme types
```

## Quality Standards

### Definition of Done
- [ ] Follows 8px grid system
- [ ] Uses design tokens exclusively
- [ ] Passes WCAG AA accessibility standards
- [ ] Responsive across all breakpoints
- [ ] Supports light/dark themes
- [ ] Includes proper focus states
- [ ] Performance tested (< 100ms interactions)
- [ ] Cross-browser compatible

### Code Review Checklist
- [ ] No hardcoded colors, spacing, or typography
- [ ] Semantic HTML structure
- [ ] Proper ARIA attributes
- [ ] Consistent naming conventions
- [ ] Component API follows design system patterns
- [ ] Documentation includes usage examples
- [ ] Unit tests for component behavior
- [ ] Visual regression tests included

---

*"Good design is as little design as possible"* - Dieter Rams

This design system embodies Nike's "Just Do It" mentality through Dieter Rams' principled approach to design. Every element serves a purpose, every decision supports the user's goals, and every interaction feels effortless and confident.