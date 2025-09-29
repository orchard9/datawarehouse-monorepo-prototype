# Professional Makefile for Peach AI Data Warehouse POC
.PHONY: help install dev-server server-start server-stop server-restart server-status test test-contracts test-clients clean setup lint

# Default target
help: ## Show this help message
	@echo "Peach AI Data Warehouse POC - Available Commands"
	@echo "================================================="
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Setup and Installation
install: ## Install Python dependencies
	pip install -r requirements.txt
	pip install psutil

setup: install ## Complete project setup
	python src/database/schema.py
	@echo "✅ Project setup complete!"

# Production Data Operations
sync: ## Sync data from Peach AI APIs
	python main.py sync

export: ## Export data to CSV
	python main.py export --format csv

status: ## Check system status
	python main.py status --detailed

# Testing
test: ## Run all tests
	python test_complete_system.py
	python test_api_clients.py
	python test_etl_pipeline.py

test-system: ## Test complete system integration
	python test_complete_system.py

test-clients: ## Test API clients
	python test_api_clients.py

# Database
db-init: ## Initialize database
	python src/database/schema.py

db-reset: ## Reset database (WARNING: destroys data)
	@echo "⚠️  This will delete all data. Press Ctrl+C to cancel, Enter to continue."
	@read
	rm -f datawarehouse.db test_datawarehouse.db
	python src/database/schema.py

# Cleanup
clean: ## Clean up temporary files
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	rm -f test_*.db debug_*.db

# Development utilities  
lint: ## Run code linting (if available)
	@echo "Linting not configured yet - add flake8/black/ruff as needed"

format: ## Format code (if available)
	@echo "Code formatting not configured yet - add black/autopep8 as needed"