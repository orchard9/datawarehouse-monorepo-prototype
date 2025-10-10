# Peach AI Data Warehouse POC

## Project Overview
Data warehouse system that pulls from 3 Peach AI endpoints, maps campaigns to a 5-tier hierarchy, and exports to Google Sheets.

## Production Configuration
The system uses `config/settings.yaml` for all configuration:
- **API settings** - Production Peach AI endpoints and authentication
- **Database config** - SQLite path and backup settings  
- **Google Sheets** - Export credentials and default titles
- **ETL pipeline** - Batch sizes, workers, quality thresholds
- **Environment overrides** - Use PEACHAI_API_TOKEN env var for security

## Quick Commands
### Production Workflow:
- `pip install -r requirements.txt` - Install dependencies
- Edit `config/settings.yaml` - Set your bearer token
- `python main.py sync` - Sync 200 campaigns from Peach AI
- `python main.py export --format csv` - Export to CSV for Google Sheets
- `python main.py status --detailed` - Check data quality

### Alternative Commands:
- `make test` or `npm test` - Run all tests  
- `make setup` or `npm run setup` - Complete project setup

## How to Get Fresh Data and Export

### Step-by-Step Process for Getting Latest Data

**1. Get Fresh Data from Peach AI**
```bash
cd datawarehouse-job
python main.py sync
```
This command:
- Pulls the latest 200 campaigns from Peach AI APIs
- Fetches recent hourly metrics data
- Maps campaigns to the 5-tier hierarchy
- Updates the SQLite database with fresh data

**2. Export to CSV Format**
```bash
python main.py export --format csv
```
This creates a CSV file in the current directory with:
- Campaign performance summary data
- All metrics aggregated by campaign
- Ready for import into Google Sheets or Excel

**3. What to Do with the Exported CSV**
The exported CSV file will be named with a timestamp (e.g., `campaign_export_2025-09-26_143022.csv`):
- **Import to Google Sheets**: Upload the file directly to Google Drive
- **Excel Analysis**: Open in Excel for pivot tables and charts
- **Data Analysis**: Use with Python pandas, R, or other analytics tools
- **Backup**: Keep copies for historical comparison

**4. Verify Data Quality**
```bash
python main.py status --detailed
```
This shows:
- Total campaigns imported
- Data freshness timestamps
- Any mapping issues or errors
- Export history and file locations

### Recently Used Commands (Tested & Working)
```bash
# Complete workflow for September 2025 data
python main.py sync                    # Get latest data
python main.py export --format csv    # Export to CSV
python main.py status --detailed      # Verify success
```

### Troubleshooting
- **Authentication Issues**: Check your bearer token in `config/settings.yaml`
- **No Data**: Verify API connectivity with `python main.py status`
- **Export Errors**: Ensure write permissions in the current directory
- **Stale Data**: Use `python main.py sync` to refresh from Peach AI

## Development Status
- ✅ Production-ready configuration system
- ✅ Database schema with 5-tier hierarchy mapping
- ✅ API clients with retry logic and authentication
- ✅ Complete ETL pipeline with 200+ campaign support
- ✅ CSV/Google Sheets export functionality
- ✅ Full CLI interface with settings integration

## Architecture
- Production Peach AI API integration
- SQLite database with comprehensive schema  
- Robust API clients with authentication & retries
- ETL pipeline with configurable YAML hierarchy rules
- Google Sheets and CSV export functionality
- CLI interface with settings.yaml configuration