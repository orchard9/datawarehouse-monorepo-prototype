# Marketing Dashboard - Main Interface Documentation

## Overview
The main dashboard (`SimpleMarketingManager.jsx`) serves as the primary interface for campaign management and analytics. It provides comprehensive campaign oversight, performance metrics, and data manipulation capabilities through a single-page interface.

## Dashboard Layout & Data Display

### 1. Header Section
- **Title:** "Marketing Dashboard"
- **Subtitle:** "Campaign Management System"
- **Context:** Immediately identifies the application purpose and scope

### 2. KPI Cards Section (6 Primary Metrics)

#### Total Clicks
- **Data Source:** `aggregatedMetrics.totalUniqueClicks`
- **Calculation:** Sum of `uniqueClicks` across all filtered campaigns
- **Display:** Formatted with thousands separators (e.g., "12,456")
- **Icon:** Mouse pointer icon
- **Purpose:** Primary engagement metric

#### Total Cost
- **Data Source:** `aggregatedMetrics.totalCost`
- **Calculation:** Sum of `cost` across all filtered campaigns
- **Display:** Currency format with 2 decimals (e.g., "$45,678.90")
- **Icon:** Dollar sign icon
- **Purpose:** Total ad spend tracking

#### Total Confirm Reg
- **Data Source:** `aggregatedMetrics.totalConfirmReg`
- **Calculation:** Sum of `confirmReg` across all filtered campaigns
- **Display:** Integer with thousands separators
- **Icon:** Users icon
- **Purpose:** Qualified registrations metric

#### Total Sales
- **Data Source:** `aggregatedMetrics.totalSales`
- **Calculation:** Sum of `sales` across all filtered campaigns
- **Display:** Integer with thousands separators
- **Icon:** Shopping cart icon
- **Purpose:** Conversion tracking

#### Total Revenue
- **Data Source:** `aggregatedMetrics.totalRevenue`
- **Calculation:** Sum of `revenue` across all filtered campaigns
- **Display:** Currency format, color-coded (green=positive, red=negative)
- **Icon:** Dollar sign (color matches value)
- **Purpose:** Primary revenue tracking

#### Overall ROI
- **Data Source:** `aggregatedMetrics.overallROI`
- **Calculation:** `((totalRevenue - totalCost) / totalCost) * 100`
- **Display:** Percentage with color coding (green=positive, red=negative)
- **Icon:** Trending up icon (color matches value)
- **Purpose:** Profitability at a glance

### 3. Interactive Charts Section

#### Revenue vs Cost Bar Chart
- **Data Source:** Top 10 campaigns by revenue from `chartData`
- **X-Axis:** Campaign names (truncated to 15 characters)
- **Y-Axis:** Dollar amounts (formatted as "$Xk")
- **Bars:**
  - Red bars: Campaign costs
  - Green bars: Campaign revenue
- **Interaction:** Hover tooltips show full campaign name and exact values
- **Purpose:** Visual comparison of spend vs return

#### ROAS Performance Line Chart
- **Data Source:** Same top 10 campaigns
- **X-Axis:** Campaign names
- **Y-Axis:** ROAS percentage
- **Line:** Blue line with data points
- **Calculation:** `(revenue / cost) * 100` per campaign
- **Interaction:** Hover shows exact ROAS percentage
- **Purpose:** Performance trend visualization

### 4. Search and Filter Controls

#### Search Input
- **Functionality:** Real-time text search
- **Search Fields:** Campaign name, vendor name
- **Behavior:** Case-insensitive partial matching
- **Placeholder:** "Search campaigns or vendors..."

#### Status Filter Dropdown
- **Options:** All Statuses, Live, Paused, Ended
- **Default:** "All Statuses"
- **Behavior:** Exact status matching

#### Multi-Vendor Filter
- **Display:** Shows selected count or "All Vendors"
- **Functionality:**
  - Dropdown with search capability
  - Individual checkboxes for each vendor
  - "Select All" / "Clear All" buttons
- **Data Source:** Unique vendors from all campaigns
- **Search:** Live filtering of vendor list

#### Date Range Filter
- **Options:**
  - Last 7 Days, Last 14 Days, Last 30 Days, Last 90 Days
  - Today, Yesterday
  - Custom Range (shows date pickers)
- **Default:** "Last 30 Days"
- **Custom Range:** Two date inputs for start/end dates

#### Reset Filters Button
- **Visibility:** Only shown when filters are active
- **Functionality:** Clears all filters to default state
- **Feedback:** Toast notification confirms reset

### 5. Action Buttons

#### CSV Export Button
- **Display:** Shows count of campaigns to export
- **State:** Disabled when no campaigns match filters
- **Functionality:** Downloads CSV with all filtered campaign data
- **Feedback:** Success/error toast notifications

#### Create Campaign Button
- **Functionality:** Opens modal dialog for new campaign creation
- **Modal Fields:**
  - Campaign Name (required)
  - Vendor/Domain (optional)
- **Behavior:** Adds campaign to store and shows success notification

### 6. Campaign Data Table

#### Table Structure
**20 Columns of campaign data:**

1. **Campaign** - Name + ID display
2. **Vendor** - Vendor/domain name
3. **Status** - Color-coded status badges
4. **Start Date** - Short date format (MMM DD, YY)
5. **End Date** - Short date format or "-"
6. **Raw Clicks** - Total click count
7. **Unique Clicks** - Deduplicated clicks
8. **Cost** - Red currency display
9. **CPC (Raw)** - Cost per raw click calculation
10. **CPC (Unique)** - Cost per unique click calculation
11. **Raw Reg** - Raw registrations
12. **CPR (Raw)** - Cost per raw registration
13. **Confirm Reg** - Confirmed registrations (bold)
14. **CPR (Confirm)** - Cost per confirmed registration
15. **Sales** - Sales count (bold, red)
16. **CPS** - Cost per sale
17. **Revenue** - Green currency display
18. **Rev/Sale** - Revenue per sale ratio
19. **LTRev** - Lifetime revenue
20. **ROAS** - Return on ad spend percentage (color-coded)

#### Column Sorting
- **Functionality:** Click any column header to sort
- **Visual Indicator:** Arrow shows sort direction (↑/↓)
- **Behavior:** Toggle between ascending/descending
- **Default:** Revenue descending

#### Row Interactions
- **Click Behavior:** Entire row clickable to view campaign details
- **Visual Feedback:** Hover highlighting
- **Navigation:** Switches to detailed campaign view

#### Calculated Fields Display
All cost-per-action fields show calculated values:
- **CPC Raw:** `cost / rawClicks` or "0.00"
- **CPC Unique:** `cost / uniqueClicks` or "0.00"
- **CPR Raw:** `cost / rawReg` or "0.00"
- **CPR Confirm:** `cost / confirmReg` or "0.00"
- **CPS:** `cost / sales` or "0.00"
- **Rev/Sale:** `revenue / sales` or "0.00"
- **ROAS:** `(revenue / cost) * 100` or "0.0"

### 7. Pagination Controls

#### Items Per Page Selector
- **Options:** 10, 25, 50, 100 items per page
- **Default:** 10 items
- **Display:** "Show: [dropdown]"

#### Page Information
- **Format:** "Showing X-Y of Z"
- **Example:** "Showing 1-10 of 247"

#### Page Navigation
- **Controls:** Previous, numbered pages (up to 5), Next
- **Current Page:** Highlighted in blue
- **Disabled States:** Previous/Next disabled at boundaries
- **Smart Display:** Shows pages around current page

### 8. Empty States

#### No Campaigns Found
- **Trigger:** When filters return no results
- **Message:** Contextual based on active filters
- **Guidance:** "Try adjusting your search or filter criteria"

#### No Chart Data
- **Trigger:** When no campaigns have cost/revenue data
- **Display:** Shows total revenue, cost, ROAS in text format
- **Message:** "No chart data available"

## Data Flow & Real-time Updates

### Filter Impact
- **Immediate:** All metrics update as filters change
- **KPI Cards:** Recalculate based on filtered campaigns
- **Charts:** Regenerate with filtered data
- **Table:** Shows only matching campaigns
- **Pagination:** Resets to page 1 on filter changes

### Performance Considerations
- **Memoization:** Heavy calculations cached with `useMemo`
- **Debouncing:** Search input debounced for performance
- **Pagination:** Large datasets handled efficiently
- **Chart Limits:** Charts limited to top 10 campaigns for readability

### User Feedback
- **Loading States:** Skeleton screens during data fetch
- **Error States:** Error boundaries with retry options
- **Toast Notifications:** Success/error feedback for actions
- **Visual Indicators:** Sort arrows, active filters, disabled states

## Responsive Behavior

### Mobile Adaptations
- **Grid Layout:** KPI cards stack vertically
- **Filter Controls:** Stack vertically on mobile
- **Table:** Horizontal scroll with minimum width
- **Buttons:** Full-width on mobile devices

### Accessibility
- **Keyboard Navigation:** All interactive elements accessible
- **Screen Readers:** Proper ARIA labels and semantic HTML
- **Color Coding:** Not solely relied upon for information
- **Focus Management:** Clear focus indicators

This dashboard provides comprehensive campaign oversight with immediate access to key performance indicators, detailed campaign data, and powerful filtering capabilities, all optimized for both data analysis and operational management tasks.