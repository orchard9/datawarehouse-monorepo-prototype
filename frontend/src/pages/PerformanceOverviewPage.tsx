import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  BarChart3,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Search
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

// Use relative URL - proxied through Vite to backend
const API_BASE_URL = '/api/datawarehouse';

// Type definitions matching backend PerformanceService
type DisplayMode = 'network' | 'domain' | 'placement' | 'targeting' | 'special';

interface PerformanceMetrics {
  cost: number;
  revenue: number;
  sales: number;
  uniqueClicks: number;
  rawClicks: number;
  confirmReg: number;
  rawReg: number;
  ltrev: number;
  // Derived metrics
  roas: number;
  ltRoas: number;
  cprConfirm: number;
  cprRaw: number;
  cps: number;
  rps: number;
  cpcUnique: number;
  cpcRaw: number;
}

interface PerformanceLeafNode {
  id: number;
  name: string;
  level: string;
  status: string;
  network: string;
  domain: string;
  placement: string;
  targeting: string;
  special: string;
  metrics: PerformanceMetrics;
}

interface HierarchyNode {
  name: string;
  level: string;
  metrics: PerformanceMetrics;
  children?: HierarchyNode[] | PerformanceLeafNode[];
}

interface PerformanceResponse {
  displayMode: DisplayMode;
  hierarchyLevels: string[];
  data: HierarchyNode[] | PerformanceLeafNode[];
  metadata: {
    totalRecords: number;
    dateRange: {
      start: string;
      end: string;
    };
    filtersApplied: Record<string, any>;
  };
}

const PerformanceOverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('network');
  const [sortColumn, setSortColumn] = useState<string | null>('cost');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Date range filter state
  const [dateRange, setDateRange] = useState<string>('last30days');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // Fetch performance data from API
  const fetchPerformanceData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Calculate actual start/end dates based on dateRange selection
      let apiStartDate: string | undefined;
      let apiEndDate: string | undefined;

      if (dateRange === 'custom') {
        apiStartDate = startDate;
        apiEndDate = endDate;
      } else if (dateRange !== 'alltime') {
        const now = new Date();
        let calculatedStart: Date;

        switch (dateRange) {
          case 'today':
            calculatedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'yesterday':
            calculatedStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            apiEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().split('T')[0];
            break;
          case 'last7days':
            calculatedStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'last14days':
            calculatedStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            break;
          case 'last30days':
            calculatedStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'last90days':
            calculatedStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            calculatedStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        apiStartDate = calculatedStart.toISOString().split('T')[0];
        if (!apiEndDate && dateRange !== 'yesterday') {
          apiEndDate = undefined; // Let backend use today as default
        }
      }

      const response = await axios.get<{
        success: boolean;
        message: string;
        data: PerformanceResponse;
      }>(`${API_BASE_URL}/performance`, {
        params: {
          display_mode: displayMode,
          ...(apiStartDate && { start_date: apiStartDate }),
          ...(apiEndDate && { end_date: apiEndDate })
        }
      });

      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.message || 'Failed to fetch performance data');
      }
    } catch (err: any) {
      console.error('Error fetching performance data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch performance data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when display mode or date range changes
  useEffect(() => {
    fetchPerformanceData();
  }, [displayMode, dateRange, startDate, endDate]);

  // Flatten hierarchical data into CSV rows
  const flattenDataForExport = (nodes: (HierarchyNode | PerformanceLeafNode)[], parentPath: string = ''): any[] => {
    const rows: any[] = [];

    nodes.forEach((node) => {
      const nodePath = parentPath ? `${parentPath} > ${node.name}` : node.name;
      const isLeaf = 'id' in node;

      // Add current node as a row
      rows.push({
        name: nodePath,
        level: node.level || displayMode,
        rawClicks: node.metrics.rawClicks,
        uniqueClicks: node.metrics.uniqueClicks,
        cost: node.metrics.cost,
        cpcRaw: node.metrics.cpcRaw,
        cpcUnique: node.metrics.cpcUnique,
        rawReg: node.metrics.rawReg,
        cprRaw: node.metrics.cprRaw,
        confirmReg: node.metrics.confirmReg,
        cprConfirm: node.metrics.cprConfirm,
        sales: node.metrics.sales,
        cps: node.metrics.cps,
        revenue: node.metrics.revenue,
        rps: node.metrics.rps,
        roas: node.metrics.roas,
        ltRoas: node.metrics.ltRoas,
      });

      // Recursively add children if they exist
      if (!isLeaf && 'children' in node && node.children && node.children.length > 0) {
        rows.push(...flattenDataForExport(node.children, nodePath));
      }
    });

    return rows;
  };

  // Convert data to CSV format
  const convertToCSV = (rows: any[]): string => {
    if (rows.length === 0) return '';

    // CSV Headers matching the table columns
    const headers = [
      displayMode === 'special' ? 'Campaign' : displayMode.charAt(0).toUpperCase() + displayMode.slice(1),
      'Raw Clicks',
      'Unique Clicks',
      'Cost',
      'CPC Raw',
      'CPC Unique',
      'Raw Reg',
      'CPR Raw',
      'Confirm Reg',
      'CPR Confirm',
      'Sales',
      'CPS',
      'Revenue',
      'RPS',
      'ROAS',
      'LT ROAS'
    ];

    // Create CSV content
    const csvRows = [headers.join(',')];

    rows.forEach(row => {
      const values = [
        `"${row.name}"`, // Wrap in quotes to handle commas in names
        row.rawClicks,
        row.uniqueClicks,
        row.cost.toFixed(2),
        row.cpcRaw.toFixed(2),
        row.cpcUnique.toFixed(2),
        row.rawReg,
        row.cprRaw.toFixed(2),
        row.confirmReg,
        row.cprConfirm.toFixed(2),
        row.sales,
        row.cps.toFixed(2),
        row.revenue.toFixed(2),
        row.rps.toFixed(2),
        row.roas.toFixed(2),
        row.ltRoas.toFixed(2)
      ];
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  };

  // Export data to CSV
  const handleExport = () => {
    if (!sortedData && !data) return;

    const dataToExport = sortedData || data;
    if (!dataToExport) return;

    // Flatten the hierarchical data
    const flattenedRows = flattenDataForExport(dataToExport.data as (HierarchyNode | PerformanceLeafNode)[]);

    // Convert to CSV
    const csvContent = convertToCSV(flattenedRows);

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `performance_${displayMode}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter hierarchical data based on search term
  const filterHierarchyData = (
    nodes: (HierarchyNode | PerformanceLeafNode)[],
    searchTerm: string
  ): (HierarchyNode | PerformanceLeafNode)[] => {
    if (!searchTerm.trim()) return nodes;

    const searchLower = searchTerm.toLowerCase();

    const filterNode = (node: HierarchyNode | PerformanceLeafNode): (HierarchyNode | PerformanceLeafNode) | null => {
      const isLeaf = 'id' in node;

      // Check if current node matches search
      const nameMatches = node.name.toLowerCase().includes(searchLower);

      // For leaf nodes, also search through hierarchy dimensions
      let dimensionMatches = false;
      if (isLeaf) {
        const leafNode = node as PerformanceLeafNode;
        dimensionMatches =
          leafNode.network.toLowerCase().includes(searchLower) ||
          leafNode.domain.toLowerCase().includes(searchLower) ||
          leafNode.placement.toLowerCase().includes(searchLower) ||
          leafNode.targeting.toLowerCase().includes(searchLower) ||
          leafNode.special.toLowerCase().includes(searchLower);
      }

      // If leaf node matches, return it
      if (isLeaf && (nameMatches || dimensionMatches)) {
        return node;
      }

      // For non-leaf nodes, recursively filter children
      if (!isLeaf && 'children' in node && node.children) {
        const filteredChildren = node.children
          .map(child => filterNode(child))
          .filter((child): child is HierarchyNode | PerformanceLeafNode => child !== null);

        // Include parent if it matches or has matching children
        if (nameMatches || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren
          } as HierarchyNode;
        }
      }

      // If non-leaf node matches but has no children (shouldn't happen), include it
      if (nameMatches && !isLeaf) {
        return node;
      }

      return null;
    };

    return nodes
      .map(node => filterNode(node))
      .filter((node): node is HierarchyNode | PerformanceLeafNode => node !== null);
  };

  // Apply search filter to data
  const filteredData = useMemo(() => {
    if (!data || !debouncedSearchTerm) return data;

    return {
      ...data,
      data: filterHierarchyData(data.data as (HierarchyNode | PerformanceLeafNode)[], debouncedSearchTerm)
    };
  }, [data, debouncedSearchTerm]);

  // Debug: Log data structure when it changes
  useEffect(() => {
    if (data) {
      console.log('📊 Performance data loaded:', {
        displayMode: data.displayMode,
        hierarchyLevels: data.hierarchyLevels,
        dataCount: Array.isArray(data.data) ? data.data.length : 0,
        firstItem: Array.isArray(data.data) && data.data.length > 0 ? data.data[0] : null
      });

      // Log first hierarchy node structure
      if (Array.isArray(data.data) && data.data.length > 0) {
        const firstNode = data.data[0];
        console.log('🌳 First node structure:', {
          name: firstNode.name,
          hasChildren: 'children' in firstNode && firstNode.children !== undefined,
          childrenCount: ('children' in firstNode && firstNode.children) ? firstNode.children.length : 0
        });
      }
    }
  }, [data]);

  // Toggle row expansion
  const toggleRow = (path: string) => {
    console.log('🔄 Toggling row:', path);
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      const wasExpanded = newSet.has(path);
      if (wasExpanded) {
        newSet.delete(path);
        console.log('➖ Collapsed:', path);
      } else {
        newSet.add(path);
        console.log('➕ Expanded:', path);
      }
      console.log('📦 Expanded rows:', Array.from(newSet));
      return newSet;
    });
  };

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort value from node
  const getSortValue = (node: HierarchyNode | PerformanceLeafNode, column: string): any => {
    if (column === 'name') {
      return node.name.toLowerCase();
    }
    // All other columns are metrics
    return node.metrics[column as keyof PerformanceMetrics];
  };

  // Sort data based on current sort column and direction
  const sortedData = useMemo(() => {
    if (!filteredData || !sortColumn) return filteredData;

    const sortNodes = (nodes: (HierarchyNode | PerformanceLeafNode)[]): (HierarchyNode | PerformanceLeafNode)[] => {
      const sorted = [...nodes].sort((a, b) => {
        const aValue = getSortValue(a, sortColumn);
        const bValue = getSortValue(b, sortColumn);

        if (aValue === bValue) return 0;

        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else {
          comparison = (aValue as number) - (bValue as number);
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });

      // Recursively sort children if they exist
      return sorted.map(node => {
        if ('children' in node && node.children && Array.isArray(node.children) && node.children.length > 0) {
          return {
            ...node,
            children: sortNodes(node.children)
          };
        }
        return node;
      });
    };

    return {
      ...filteredData,
      data: sortNodes(Array.isArray(filteredData.data) ? filteredData.data : [])
    };
  }, [filteredData, sortColumn, sortDirection]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format number
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format decimal
  const formatDecimal = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  // Get ROAS color class
  const getRoasColor = (roas: number) => {
    if (roas >= 2.0) return 'text-green-600';
    if (roas >= 1.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Render metrics row
  const renderMetrics = (metrics: PerformanceMetrics) => (
    <>
      <td className="px-4 py-3 text-sm text-right">{formatNumber(metrics.rawClicks)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatNumber(metrics.uniqueClicks)}</td>
      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(metrics.cost)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.cpcRaw)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.cpcUnique)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatNumber(metrics.rawReg)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.cprRaw)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatNumber(metrics.confirmReg)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.cprConfirm)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatNumber(metrics.sales)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.cps)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.revenue)}</td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(metrics.rps)}</td>
      <td className={`px-4 py-3 text-sm text-right font-semibold ${getRoasColor(metrics.roas)}`}>
        {formatDecimal(metrics.roas, 2)}x
      </td>
      <td className="px-4 py-3 text-sm text-right">{formatDecimal(metrics.ltRoas, 2)}x</td>
    </>
  );

  // Recursively render hierarchy nodes
  const renderHierarchyNode = (node: HierarchyNode | PerformanceLeafNode, path: string = '', depth: number = 0): JSX.Element[] => {
    const isLeaf = 'id' in node;
    const nodePath = path ? `${path}/${node.name}` : node.name;
    const hasChildren = !isLeaf && node.children && node.children.length > 0;
    const isExpanded = expandedRows.has(nodePath);
    const childrenCount = hasChildren && node.children ? node.children.length : 0;

    // Debug logging for first few nodes
    if (depth === 0 || (depth === 1 && Math.random() < 0.1)) {
      console.log(`🔍 Rendering node at depth ${depth}:`, {
        name: node.name,
        path: nodePath,
        isLeaf,
        hasChildren,
        childrenCount,
        isExpanded
      });
    }

    const rows: JSX.Element[] = [];

    // Main row
    rows.push(
      <tr
        key={nodePath}
        onClick={isLeaf ? () => navigate(`/campaigns/${(node as PerformanceLeafNode).id}`) : undefined}
        className={`
          border-b border-gray-200 hover:bg-gray-50 transition-colors
          ${isLeaf ? 'bg-white cursor-pointer' : 'bg-gray-50 font-medium'}
        `}
      >
        <td className="px-4 py-3 sticky left-0 bg-inherit z-10 border-r border-gray-200">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
            {hasChildren && (
              <button
                onClick={() => toggleRow(nodePath)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-600" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-600" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-6" />}
            <span className="text-sm truncate max-w-xs">
              {node.name}
              {hasChildren && childrenCount > 0 && (
                <span className="ml-2 text-xs text-gray-500">({childrenCount})</span>
              )}
            </span>
            {isLeaf && (
              <span className={`
                ml-2 px-2 py-1 rounded-full text-xs
                ${(node as PerformanceLeafNode).status === 'Active' ? 'bg-green-100 text-green-800' :
                  (node as PerformanceLeafNode).status === 'Paused' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'}
              `}>
                {(node as PerformanceLeafNode).status}
              </span>
            )}
          </div>
        </td>
        {renderMetrics(node.metrics)}
      </tr>
    );

    // Children rows (if expanded)
    if (hasChildren && isExpanded && node.children) {
      node.children.forEach((child: any) => {
        rows.push(...renderHierarchyNode(child, nodePath, depth + 1));
      });
    }

    return rows;
  };

  // Render flat data (for special mode)
  const renderFlatData = (items: PerformanceLeafNode[]): JSX.Element[] => {
    return items.map(item => (
      <tr
        key={item.id}
        onClick={() => navigate(`/campaigns/${item.id}`)}
        className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm truncate max-w-xs">{item.name}</span>
            <span className={`
              ml-2 px-2 py-1 rounded-full text-xs
              ${item.status === 'Active' ? 'bg-green-100 text-green-800' :
                item.status === 'Paused' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'}
            `}>
              {item.status}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {item.network} / {item.domain} / {item.placement}
          </div>
        </td>
        {renderMetrics(item.metrics)}
      </tr>
    ));
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-lg text-gray-600">Loading performance data...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Error Loading Data</h3>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={fetchPerformanceData}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">No performance data found for the selected filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1920px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Performance Overview
            </h1>
            <p className="text-gray-600 mt-1">
              Hierarchical performance analytics with dynamic rollups
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchPerformanceData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExport}
              disabled={!data || loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          {/* Search Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search networks, domains, campaigns..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-4 ${dateRange === 'custom' ? 'md:grid-cols-2 lg:grid-cols-5' : 'md:grid-cols-3'}`}>
            {/* Display Mode Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Mode
              </label>
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="network">Network View (5-level)</option>
                <option value="domain">Domain View (4-level)</option>
                <option value="placement">Placement View (3-level)</option>
                <option value="targeting">Targeting View (2-level)</option>
                <option value="special">Flat View (All Campaigns)</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="alltime">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last14days">Last 14 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last90days">Last 90 Days</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Custom Date Range Inputs - Show when 'custom' is selected */}
            {dateRange === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate || ''}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate || ''}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Total Records */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Campaigns
              </label>
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-900">
                {data.metadata.totalRecords} campaigns
              </div>
            </div>
          </div>

          {/* Active Date Range Display */}
          {data && (
            <div className="mt-4 text-sm text-gray-600">
              <span className="font-medium">Showing data for:</span>{' '}
              {data.metadata.dateRange.start} to {data.metadata.dateRange.end}
            </div>
          )}
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-gray-50 z-30 border-r border-gray-200">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    {displayMode === 'special' ? 'Campaign' : displayMode.charAt(0).toUpperCase() + displayMode.slice(1)}
                    {sortColumn === 'name' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('raw_clicks')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Raw Clicks
                    {sortColumn === 'raw_clicks' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('unique_clicks')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Unique Clicks
                    {sortColumn === 'unique_clicks' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('cost')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Cost
                    {sortColumn === 'cost' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('cpc_raw')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    CPC Raw
                    {sortColumn === 'cpc_raw' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('cpc_unique')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    CPC Unique
                    {sortColumn === 'cpc_unique' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('raw_reg')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Raw Reg
                    {sortColumn === 'raw_reg' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('cpr_raw')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    CPR Raw
                    {sortColumn === 'cpr_raw' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('confirm_reg')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Confirm Reg
                    {sortColumn === 'confirm_reg' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('cpr_confirm')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    CPR Confirm
                    {sortColumn === 'cpr_confirm' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('sales')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Sales
                    {sortColumn === 'sales' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('cps')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    CPS
                    {sortColumn === 'cps' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('revenue')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    Revenue
                    {sortColumn === 'revenue' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSort('rps')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    RPS
                    {sortColumn === 'rps' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right bg-green-50">
                  <button
                    onClick={() => handleSort('roas')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    ROAS
                    {sortColumn === 'roas' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-right bg-green-50">
                  <button
                    onClick={() => handleSort('lt_roas')}
                    className="flex items-center justify-end gap-1 w-full text-xs font-semibold text-gray-700 uppercase tracking-wider hover:text-orange-600 transition-colors"
                  >
                    LT ROAS
                    {sortColumn === 'lt_roas' ? (
                      sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    ) : (
                      <ArrowUpDown size={14} className="opacity-40" />
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayMode === 'special'
                ? renderFlatData((sortedData || data).data as PerformanceLeafNode[])
                : ((sortedData || data).data as HierarchyNode[]).flatMap(node => renderHierarchyNode(node))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformanceOverviewPage;
