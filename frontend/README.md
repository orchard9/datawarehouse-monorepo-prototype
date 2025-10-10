# Orchard9 Data Warehouse - Frontend

Marketing analytics dashboard built with React + TypeScript + Vite.

## Campaign Metrics Documentation

The Marketing Dashboard displays comprehensive campaign performance data. Some metrics are **placeholders** awaiting backend implementation:

### Available Metrics

- **CAMPAIGN**: Campaign name and slug
- **STATUS**: Live/Paused serving status
- **SESSIONS**: Anonymous user visits (not yet registered)
- **CONFIRM REG**: Confirmed user registrations (email/Google/Facebook auth)
- **CPR (CONFIRM)**: Cost Per Confirmed Registration - Calculated as `cost / confirmRegistrations`
  - Shows actual calculated values
  - Displays "—" when registrations = 0
  - Format: `$X.XX`
- **SALES**: Users who became paying customers (completed monetizable action)
  - Each sale generates $25.50 average revenue
  - This is the ultimate conversion metric (not just registration)
- **CPS**: Cost Per Sale - Calculated as `cost / sales`
  - Shows actual calculated values
  - Displays "—" when sales = 0
  - Format: `$X.XX`
  - Measures cost efficiency of acquiring paying customers
- **COST**: Campaign spending (currently estimated)
- **REVENUE**: Revenue generated (currently estimated)
- **RPS**: Revenue Per Sale - Calculated as `revenue / sales`
  - Shows actual calculated values
  - Displays "—" when sales = 0
  - Format: `$X.XX`
  - Currently displays $25.50 (average revenue per sale)
  - Tracks average transaction value per paying customer
- **ROAS**: Return on Ad Spend ratio

### Placeholder Metrics (Future Implementation)

The following columns are **placeholders** displaying "—" until backend support is added:

#### 1. RAW CLICKS
- **Definition**: Total ad clicks including duplicates (same user clicking multiple times)
- **Data Source**: Peach AI API (to be implemented)
- **Field Name**: `campaign.metrics.rawClicks`
- **Type**: `number`
- **Use Case**: Track total engagement including repeat clicks

#### 2. UNIQUE CLICKS
- **Definition**: Deduplicated clicks (one per unique user)
- **Data Source**: Peach AI API (to be implemented)
- **Field Name**: `campaign.metrics.uniqueClicks`
- **Type**: `number`
- **Use Case**: Measure unique user engagement

#### 3. CPC (RAW)
- **Definition**: Cost Per Click based on total clicks
- **Calculation**: `cost / rawClicks`
- **Data Source**: Frontend calculation
- **Type**: `number` (currency)
- **Display**: `$X.XX`
- **Note**: Shows "—" when rawClicks unavailable or zero

#### 4. CPC (UNIQUE)
- **Definition**: Cost Per Click based on unique users
- **Calculation**: `cost / uniqueClicks`
- **Data Source**: Frontend calculation
- **Type**: `number` (currency)
- **Display**: `$X.XX`
- **Note**: Shows "—" when uniqueClicks unavailable or zero

#### 5. RAW REG
- **Definition**: Incomplete registrations (started but not confirmed)
- **Data Source**: Peach AI API (to be implemented)
- **Field Name**: `campaign.metrics.rawRegistrations`
- **Type**: `number`
- **Description**: Users who provided email/info but didn't verify account
- **Relationship**: `rawRegistrations + confirmRegistrations = total registration attempts`

#### 6. CPR (RAW)
- **Definition**: Cost Per Raw Registration
- **Calculation**: `cost / rawRegistrations`
- **Data Source**: Frontend calculation
- **Type**: `number` (currency)
- **Display**: `$X.XX`
- **Note**: Shows "—" when rawRegistrations unavailable or zero
- **Use Case**: Measure cost efficiency of attracting users to start registration process

#### 7. LTREV (Long-Term Revenue)
- **Definition**: Customer Lifetime Value or long-term revenue projection
- **Data Source**: **REQUIRES DATA SCIENCE INPUT** - calculation methodology to be determined
- **Potential Approaches**:
  - Lifetime Value (LTV): `(Avg Revenue Per User) × (Avg Customer Lifespan)`
  - Cumulative Revenue: Total revenue over customer relationship
  - Projected Revenue: Future revenue based on growth trajectory
  - Retention Value: Revenue from repeat purchases
- **Missing Data Requirements**:
  - Customer churn rate
  - Average customer lifetime/retention period
  - Repeat purchase behavior
  - Subscription or recurring revenue data
  - Customer segmentation data
- **Type**: `number` (currency)
- **Display**: `$X.XX`
- **Note**: Awaiting data science team to define calculation methodology and required data pipeline
- **Use Case**: Understand long-term value of acquired customers for better ROI assessment

### Implementation Guide

To implement these placeholder metrics:

1. **Backend Changes**:
   - Add tracking fields to Peach AI API responses
   - Update database schema to store new metrics
   - Modify ETL pipeline to process click and registration data

2. **Frontend Changes**:
   - Update `MarketingDashboard.tsx` table cells
   - Replace `—` with actual data: `{(campaign.metrics?.fieldName || 0).toLocaleString()}`
   - Add calculation logic for CPC metrics
   - Handle division by zero gracefully

3. **Type Definitions**:
   - Add fields to `Campaign` or `CampaignMetrics` TypeScript interface
   - Regenerate API types if using OpenAPI/Orval

See inline comments in `MarketingDashboard.tsx` for detailed implementation notes.

---

## Development Setup

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
