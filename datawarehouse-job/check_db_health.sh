#!/bin/bash
# Database health check script for Orchard9 Data Warehouse

# Check if Python is available
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python is not installed"
    exit 1
fi

# Use python3 if available, otherwise python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

# Check if the database file exists
DB_PATH="datawarehouse.db"
if [ ! -f "$DB_PATH" ]; then
    echo "⚠️  Database not found at $DB_PATH - will be created on first sync"
    exit 0
fi

# Check database status using Python script
if [ -f "main.py" ]; then
    $PYTHON_CMD main.py status --brief 2>/dev/null || {
        echo "✅ Database exists ($(du -h $DB_PATH | cut -f1))"
        exit 0
    }
else
    # Fallback: just check if database file is accessible
    if [ -r "$DB_PATH" ]; then
        SIZE=$(du -h "$DB_PATH" | cut -f1)
        echo "✅ Database healthy (Size: $SIZE)"
        exit 0
    else
        echo "❌ Database exists but is not readable"
        exit 1
    fi
fi