# 🚀 Getting Started Checklist - Orchard9 Data Warehouse

Welcome to the Orchard9 Data Warehouse - an enterprise marketing analytics platform that combines powerful ETL pipelines with elegant visualization capabilities.

This **interactive checklist** will guide you through setting up a complete development environment from scratch. Check off each item as you complete it!

**📅 Total Setup Time:** Approximately 30-45 minutes (depending on download speeds and system)

## 📋 Table of Contents

- [🔧 Prerequisites Checklist (5-10 minutes)](#prerequisites-checklist)
- [📁 Project Overview](#project-overview)
- [🏗️ Environment Setup Checklist (5 minutes)](#environment-setup-checklist)
- [⚙️ Component Setup Checklist (15-20 minutes)](#component-setup-checklist)
- [🗄️ Database Setup Checklist (3-5 minutes)](#database-setup-checklist)
- [🔑 Configuration Checklist (2-5 minutes)](#configuration-checklist)
- [▶️ Running the Application Checklist (5 minutes)](#running-the-application-checklist)
- [🔄 Development Workflow](#development-workflow)
- [🧪 Testing Checklist](#testing-checklist)
- [🔧 Troubleshooting](#troubleshooting)
- [📚 Next Steps](#next-steps)

## 🔧 Prerequisites Checklist
**⏱️ Time Estimate:** 5-10 minutes

Before starting, ensure you have the following installed on your system:

### Required Software

- [ ] **Node.js** (v18.0.0 or higher) ✨

  **Check if installed:**
  ```bash
  node --version
  npm --version
  ```

  **📝 Expected Output:** `v18.x.x` or higher for Node.js, `9.x.x` or higher for npm

  **If not installed:**
  - 🍎 **macOS:** `brew install node` or download from [nodejs.org](https://nodejs.org/)
  - 🪟 **Windows:** Download installer from [nodejs.org](https://nodejs.org/)
  - 🐧 **Linux:** `sudo apt update && sudo apt install nodejs npm`

  **✅ Success Indicator:** Both commands return version numbers without errors

- [ ] **Python** (v3.8 or higher, recommended 3.11+) 🐍

  **Check if installed:**

  🍎 **macOS/Linux:**
  ```bash
  python3 --version
  pip3 --version
  ```

  🪟 **Windows:**
  ```cmd
  python --version
  pip --version
  ```

  **📝 Expected Output:** `Python 3.8.x` or higher, `pip 21.x.x` or higher

  **If not installed:**
  - 🍎 **macOS:** `brew install python`
  - 🪟 **Windows:** Download from [python.org](https://python.org/) (⚠️ Make sure to check "Add Python to PATH")
  - 🐧 **Linux:** `sudo apt update && sudo apt install python3 python3-pip`

  **✅ Success Indicator:** Python and pip commands return version numbers

- [ ] **Git** (for version control) 📚

  **Check if installed:**
  ```bash
  git --version
  ```

  **📝 Expected Output:** `git version 2.x.x` or higher

  **If not installed:**
  - 🍎 **macOS:** Included with Xcode command line tools: `xcode-select --install`
  - 🪟 **Windows:** Download from [git-scm.com](https://git-scm.com/)
  - 🐧 **Linux:** `sudo apt install git`

  **✅ Success Indicator:** Git version displayed without errors

### 🔧 System Requirements Verification

- [ ] **Check available disk space** (minimum 2GB free)

  🍎 **macOS/Linux:**
  ```bash
  df -h .
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  Get-PSDrive C
  ```

- [ ] **Terminal/Command Prompt access**
  - 🍎 **macOS:** Terminal app (Applications → Utilities → Terminal)
  - 🪟 **Windows:** Command Prompt or PowerShell (Windows key + R → cmd or powershell)
  - 🐧 **Linux:** Terminal emulator

### 📦 Optional but Recommended

- [ ] **VS Code** or your preferred IDE
- [ ] **Postman** or similar API testing tool
- [ ] **DB Browser for SQLite** for database inspection ([download here](https://sqlitebrowser.org/))

### ✅ Prerequisites Complete!

**Checkpoint:** All required software versions checked and installations completed

## 📁 Project Overview

This is a monorepo with three main components:

```
datawarehouse/
├── frontend/           # React + Vite application (Port 37950)
├── backend/           # Express.js API server (Port 37951)
├── datawarehouse-job/ # Python ETL pipeline
└── docs/             # Documentation
```

**🌐 Port Allocation:**
- Frontend: `http://localhost:37950`
- Backend API: `http://localhost:37951`

---

## 🏗️ Environment Setup Checklist
**⏱️ Time Estimate:** 5 minutes

### Step 1: Clone the Repository

- [ ] **Clone the repository**

  ```bash
  git clone <repository-url>
  cd datawarehouse
  ```

  **📝 Expected Output:** Repository cloned successfully, you're now in the `datawarehouse` directory

  **✅ Success Indicator:** You're in the project root directory

### Step 2: Verify Directory Structure

- [ ] **Check project structure**

  🍎 **macOS/Linux:**
  ```bash
  ls -la
  ```

  🪟 **Windows (Command Prompt):**
  ```cmd
  dir
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  Get-ChildItem
  ```

  **📝 Expected Output:** You should see directories: `backend/`, `datawarehouse-job/`, `frontend/`, and files: `README.md`, `CLAUDE.md`

  **✅ Success Indicator:** All three main component directories are present

### ✅ Environment Setup Complete!

**Checkpoint:** Repository cloned and directory structure verified

## ⚙️ Component Setup Checklist
**⏱️ Time Estimate:** 15-20 minutes

### 🎨 Frontend Setup (React + Vite) - 5 minutes

- [ ] **Navigate to frontend directory**

  ```bash
  cd frontend
  ```

  **✅ Success Indicator:** Command prompt shows you're in the `frontend` directory

- [ ] **Install dependencies**

  ```bash
  npm install
  ```

  **📝 Expected Output:** Package installation with no errors, shows installed package count
  **⏱️ Time:** ~2-3 minutes (depending on internet speed)

  **✅ Success Indicator:** `node_modules` directory created, `package-lock.json` updated

- [ ] **Verify frontend setup with type checking**

  ```bash
  npm run typecheck
  ```

  **📝 Expected Output:** "Found 0 errors" or similar TypeScript success message

  **✅ Success Indicator:** No TypeScript errors displayed

- [ ] **Verify frontend setup with linting**

  ```bash
  npm run lint
  ```

  **📝 Expected Output:** No ESLint errors or warnings

  **✅ Success Indicator:** Clean linting report

### 🔧 Backend Setup (Express.js + TypeScript) - 5 minutes

- [ ] **Navigate to backend directory**

  🍎 **macOS/Linux:**
  ```bash
  cd ../backend
  ```

  🪟 **Windows:**
  ```cmd
  cd ..\backend
  ```

  **✅ Success Indicator:** Command prompt shows you're in the `backend` directory

- [ ] **Install dependencies**

  ```bash
  npm install
  ```

  **📝 Expected Output:** Package installation with no errors
  **⏱️ Time:** ~1-2 minutes

  **✅ Success Indicator:** `node_modules` directory created, dependencies installed successfully

- [ ] **Create environment configuration**

  🍎 **macOS/Linux:**
  ```bash
  cp .env.example .env
  ```

  🪟 **Windows (Command Prompt):**
  ```cmd
  copy .env.example .env
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```

  **✅ Success Indicator:** `.env` file created

- [ ] **Verify .env file contents (optional customization)**

  Default contents should work for development:
  ```
  PORT=37951
  NODE_ENV=development
  DATABASE_PATH=../datawarehouse-job/datawarehouse.db
  CORS_ORIGIN=http://localhost:37950
  ```

  **✅ Success Indicator:** `.env` file contains proper configuration

- [ ] **Build the TypeScript code**

  ```bash
  npm run build
  ```

  **📝 Expected Output:** Successful TypeScript compilation with `dist` folder created

  **✅ Success Indicator:** Build completes without errors, `dist/` directory created

- [ ] **Run backend tests**

  ```bash
  npm test
  ```

  **📝 Expected Output:** All tests passing

  **✅ Success Indicator:** Test suite passes without failures

### 🐍 Data Warehouse ETL Setup (Python) - 5-10 minutes

- [ ] **Navigate to datawarehouse-job directory**

  🍎 **macOS/Linux:**
  ```bash
  cd ../datawarehouse-job
  ```

  🪟 **Windows:**
  ```cmd
  cd ..\datawarehouse-job
  ```

  **✅ Success Indicator:** Command prompt shows you're in the `datawarehouse-job` directory

- [ ] **Create Python virtual environment (recommended)**

  🍎 **macOS/Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

  🪟 **Windows (Command Prompt):**
  ```cmd
  python -m venv venv
  venv\Scripts\activate
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  python -m venv venv
  venv\Scripts\Activate.ps1
  ```

  **📝 Expected Output:** Command prompt changes to show `(venv)` prefix

  **✅ Success Indicator:** Virtual environment activated (prompt shows `(venv)`)

- [ ] **Install Python dependencies**

  🍎 **macOS/Linux:**
  ```bash
  pip3 install -r requirements.txt
  ```

  🪟 **Windows:**
  ```cmd
  pip install -r requirements.txt
  ```

  **📝 Expected Output:** All packages installed successfully
  **⏱️ Time:** ~2-5 minutes (depending on internet speed)

  **✅ Success Indicator:** All packages install without errors

- [ ] **Verify Python ETL installation**

  ```bash
  python main.py --help
  ```

  **📝 Expected Output:** CLI help text showing available commands like `sync`, `export`, `status`

  **✅ Success Indicator:** Help text displays with all available commands

### ✅ Component Setup Complete!

**Checkpoint:** All three components (Frontend, Backend, Python ETL) are installed and verified

## 🗄️ Database Setup Checklist
**⏱️ Time Estimate:** 3-5 minutes

### Initialize the Database

- [ ] **Ensure you're in the datawarehouse-job directory**

  🍎 **macOS/Linux:**
  ```bash
  cd datawarehouse-job  # if not already there
  ```

  🪟 **Windows:**
  ```cmd
  cd datawarehouse-job
  ```

  **✅ Success Indicator:** Command prompt shows you're in the `datawarehouse-job` directory

- [ ] **Ensure virtual environment is activated (if using)**

  **📝 Look for:** `(venv)` prefix in your command prompt

  **If not activated:**
  - 🍎 **macOS/Linux:** `source venv/bin/activate`
  - 🪟 **Windows (Command Prompt):** `venv\Scripts\activate`
  - 🪟 **Windows (PowerShell):** `venv\Scripts\Activate.ps1`

- [ ] **Initialize the database schema**

  ```bash
  python src/database/schema.py
  ```

  **📝 Expected Output:**
  - "Database tables created successfully" or similar success message
  - No error messages

  **✅ Success Indicator:** Schema initialization completes without errors

- [ ] **Verify database creation**

  🍎 **macOS/Linux:**
  ```bash
  ls -la datawarehouse.db
  ```

  🪟 **Windows (Command Prompt):**
  ```cmd
  dir datawarehouse.db
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  Get-Item datawarehouse.db
  ```

  **📝 Expected Output:** Database file exists and is several KB in size (not 0 bytes)

  **✅ Success Indicator:** `datawarehouse.db` file exists with reasonable file size

### Load Sample Data (Optional)

- [ ] **Check system status**

  ```bash
  python main.py status --detailed
  ```

  **📝 Expected Output:** System status report showing database connection and table information

  **✅ Success Indicator:** Status command runs without errors, shows database statistics

- [ ] **API token setup** (Optional - for real data sync)

  **Note:** You can skip this for now and come back to it in the Configuration section. The application will work without an API token for development.

### ✅ Database Setup Complete!

**Checkpoint:** SQLite database initialized with proper schema and verified

## 🔑 Configuration Checklist
**⏱️ Time Estimate:** 2-5 minutes (can be done later if needed)

### 🔌 API Configuration (Optional for Development)

**Note:** You can skip this section for initial setup and return later when you need to sync real data.

The ETL system requires a Peach AI API token for data synchronization.

#### Option 1: Environment Variable (Recommended for Security)

- [ ] **Set environment variable (if you have an API token)**

  🍎 **macOS/Linux:**
  ```bash
  export PEACHAI_API_TOKEN="your-bearer-token-here"
  ```

  🪟 **Windows (Command Prompt):**
  ```cmd
  set PEACHAI_API_TOKEN=your-bearer-token-here
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  $env:PEACHAI_API_TOKEN = "your-bearer-token-here"
  ```

  **✅ Success Indicator:** Environment variable is set (verify with `echo $PEACHAI_API_TOKEN` on Unix or `echo %PEACHAI_API_TOKEN%` on Windows)

#### Option 2: Configuration File

- [ ] **Edit configuration file (alternative to environment variable)**

  **File to edit:** `config/settings.yaml`

  **Add your token:**
  ```yaml
  api:
    bearer_token: "your-bearer-token-here"
  ```

  **✅ Success Indicator:** Token added to settings.yaml file

  **⚠️ Security Note:** Never commit real API tokens to version control!

### 📊 Google Sheets Export (Optional)

**Note:** Skip this section unless you specifically need Google Sheets integration.

- [ ] **Get Google API credentials** (if needed)

  **Steps:**
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create a project and enable Google Sheets API
  3. Download credentials JSON file

  **✅ Success Indicator:** Google credentials JSON file downloaded

- [ ] **Place credentials in config directory**

  🍎 **macOS/Linux:**
  ```bash
  cp /path/to/your/credentials.json config/google_credentials.json
  ```

  🪟 **Windows:**
  ```cmd
  copy "C:\path\to\your\credentials.json" config\google_credentials.json
  ```

  **✅ Success Indicator:** Credentials file placed in `config/google_credentials.json`

### ✅ Configuration Complete!

**Checkpoint:**
- ✅ Basic configuration verified (can proceed without API tokens)
- ✅ Optional API and Google Sheets configuration available when needed

## ▶️ Running the Application Checklist
**⏱️ Time Estimate:** 5 minutes

### 🚀 Start All Components

**Important:** You'll need **THREE terminal windows/tabs** running simultaneously!

#### 📶 Terminal 1: Backend API Server

- [ ] **Navigate to backend directory and start server**

  🍎 **macOS/Linux:**
  ```bash
  cd backend
  npm run dev
  ```

  🪟 **Windows:**
  ```cmd
  cd backend
  npm run dev
  ```

  **📝 Expected Output:**
  ```
  🚀 Server running on http://localhost:37951
  📊 Database connected: ../datawarehouse-job/datawarehouse.db
  ```

  **⚠️ Important:** Keep this terminal window open and running!

  **✅ Success Indicator:** Server starts on port 37951 without errors, database connection confirmed

#### 🎨 Terminal 2: Frontend Development Server

- [ ] **Open a NEW terminal window/tab and start frontend**

  🍎 **macOS/Linux:**
  ```bash
  cd frontend
  npm run dev
  ```

  🪟 **Windows:**
  ```cmd
  cd frontend
  npm run dev
  ```

  **📝 Expected Output:**
  ```
  VITE v7.1.7  ready in 1234 ms

  ➜  Local:   http://localhost:37950/
  ➜  Network: use --host to expose
  ```

  **⚠️ Important:** Keep this terminal window open and running!

  **✅ Success Indicator:** Vite dev server starts on port 37950, shows ready message

#### 🐍 Terminal 3: Data Warehouse Operations

- [ ] **Open a THIRD terminal window/tab for ETL operations**

  🍎 **macOS/Linux:**
  ```bash
  cd datawarehouse-job
  # Activate virtual environment if using one
  source venv/bin/activate
  python main.py status --detailed
  ```

  🪟 **Windows (Command Prompt):**
  ```cmd
  cd datawarehouse-job
  REM Activate virtual environment if using one
  venv\Scripts\activate
  python main.py status --detailed
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  cd datawarehouse-job
  # Activate virtual environment if using one
  venv\Scripts\Activate.ps1
  python main.py status --detailed
  ```

  **📝 Expected Output:** System status report with database statistics

  **✅ Success Indicator:** ETL system responds with status information

### 🔍 Verify Everything is Working

- [ ] **Test Frontend Application**

  **Action:** Open [http://localhost:37950](http://localhost:37950) in your browser

  **📝 Expected Output:** Orchard9 Data Warehouse dashboard loads successfully

  **✅ Success Indicator:** Web application loads without errors, shows dashboard interface

- [ ] **Test Backend API Health**

  **Action:** Open [http://localhost:37951/health](http://localhost:37951/health) in your browser

  **📝 Expected Output:**
  ```json
  {"status": "healthy", "timestamp": "2025-09-29T..."}
  ```

  **✅ Success Indicator:** API returns healthy status with timestamp

- [ ] **Test Database Connection from ETL**

  **Action:** In Terminal 3 (datawarehouse-job), run:
  ```bash
  python main.py status
  ```

  **📝 Expected Output:** System status with database information, table counts, etc.

  **✅ Success Indicator:** Status command completes successfully, shows database statistics

### 🎉 Application Running Successfully!

**Checkpoint:**
- ✅ Backend API server running on port 37951
- ✅ Frontend development server running on port 37950
- ✅ Python ETL system operational and connected to database
- ✅ All three components verified and working

**🎯 You're now ready to develop!** The application is fully operational.

## 🔄 Development Workflow

### 📅 Daily Development Process

This is your typical workflow once everything is set up:

#### Morning Startup Checklist

- [ ] **Start all three development servers** (see "Running the Application" section above)
  - Backend API server (Terminal 1)
  - Frontend dev server (Terminal 2)
  - ETL operations terminal (Terminal 3)

- [ ] **Verify all systems are running**
  - ✅ http://localhost:37950 (Frontend)
  - ✅ http://localhost:37951/health (Backend API)

#### Code Development Cycle

- [ ] **Make your code changes**
- [ ] **Test changes in browser** (http://localhost:37950)
- [ ] **Run quality checks before committing**

### 🔍 Code Quality Checklist

**IMPORTANT:** All quality checks must pass before committing code.

#### Frontend Quality Checks

- [ ] **Run all frontend checks**

  ```bash
  cd frontend
  npm run check:all  # Runs lint, typecheck, circular dependency check
  ```

  **✅ Success Indicator:** All checks pass without errors

#### Backend Quality Checks

- [ ] **Run backend linting**

  ```bash
  cd backend
  npm run lint
  ```

  **✅ Success Indicator:** No ESLint errors or warnings

- [ ] **Run backend type checking**

  ```bash
  npm run type-check
  ```

  **✅ Success Indicator:** No TypeScript errors

- [ ] **Run backend tests**

  ```bash
  npm test
  ```

  **✅ Success Indicator:** All tests pass

#### Python ETL Quality Checks

- [ ] **Run Python tests**

  🍎 **macOS/Linux:**
  ```bash
  cd datawarehouse-job
  make test  # or: python test_complete_system.py
  ```

  🪟 **Windows:**
  ```cmd
  cd datawarehouse-job
  python test_complete_system.py
  ```

  **✅ Success Indicator:** All Python tests pass

### 🏗️ Code Quality Standards

The project maintains strict code quality standards:

- **TypeScript/JavaScript:** ESLint with strict rules
- **Python:** Flake8 and Black formatting
- **Testing:** Comprehensive test coverage for critical paths

## 🧪 Testing Checklist

### 🎨 Frontend Testing

- [ ] **Run frontend tests once**

  ```bash
  cd frontend
  npm test
  ```

  **✅ Success Indicator:** All tests pass

- [ ] **Run tests with coverage report**

  ```bash
  npm run test:coverage
  ```

  **✅ Success Indicator:** Coverage report generated, meets project standards

- [ ] **Run tests in interactive UI mode** (optional)

  ```bash
  npm run test:ui
  ```

  **✅ Success Indicator:** Test UI opens in browser, tests can be run interactively

### 🔧 Backend Testing

- [ ] **Run backend unit tests**

  ```bash
  cd backend
  npm test
  ```

  **✅ Success Indicator:** All unit tests pass

- [ ] **Run tests in watch mode** (for development)

  ```bash
  npm run test:watch
  ```

  **✅ Success Indicator:** Tests run continuously, watching for file changes

- [ ] **Generate backend test coverage**

  ```bash
  npm run test:coverage
  ```

  **✅ Success Indicator:** Coverage report shows adequate test coverage

### 🐍 Python Testing

- [ ] **Run complete system test**

  ```bash
  cd datawarehouse-job
  python test_complete_system.py
  ```

  **✅ Success Indicator:** Full system integration test passes

- [ ] **Run API client tests**

  ```bash
  python test_api_clients.py
  ```

  **✅ Success Indicator:** API client tests pass

- [ ] **Run ETL pipeline tests**

  ```bash
  python test_etl_pipeline.py
  ```

  **✅ Success Indicator:** ETL pipeline tests pass

- [ ] **Run all Python tests with Make** (Alternative)

  🍎 **macOS/Linux:**
  ```bash
  make test
  ```

  🪟 **Windows (if Make is installed):**
  ```cmd
  make test
  ```

  **✅ Success Indicator:** All Python test suites pass

## 🔧 Troubleshooting

### 🚨 Common Issues & Solutions

#### 🔌 Port Already in Use

**Problem:** Error messages about ports 37950 or 37951 being in use

**Solution:**

🍎 **macOS/Linux:**
```bash
# Kill processes on reserved ports
lsof -ti:37950 | xargs kill -9  # Frontend port
lsof -ti:37951 | xargs kill -9  # Backend port
```

🪟 **Windows (Command Prompt):**
```cmd
# Find and kill process using port 37950
netstat -ano | findstr :37950
taskkill /PID <process-id> /F

# Find and kill process using port 37951
netstat -ano | findstr :37951
taskkill /PID <process-id> /F
```

🪟 **Windows (PowerShell):**
```powershell
# Kill processes using ports
Get-Process -Id (Get-NetTCPConnection -LocalPort 37950).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 37951).OwningProcess | Stop-Process -Force
```

#### 🐍 Python Dependencies Issues

**Problem:** Python package installation errors or import errors

**Solution:**

🍎 **macOS/Linux:**
```bash
# Recreate virtual environment
cd datawarehouse-job
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
```

🪟 **Windows:**
```cmd
# Recreate virtual environment
cd datawarehouse-job
rmdir /s venv
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

#### 📦 Node.js Dependencies Issues

**Problem:** npm install errors or module not found errors

**Solution:**

🍎 **macOS/Linux:**
```bash
# Clear npm cache and reinstall
cd frontend  # or backend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

🪟 **Windows:**
```cmd
# Clear npm cache and reinstall
cd frontend
rmdir /s node_modules
del package-lock.json
npm cache clean --force
npm install
```

#### 🗄️ Database Issues

**Problem:** Database connection errors or schema issues

**Solution:**
```bash
cd datawarehouse-job
# Reset database (WARNING: Deletes all data)
```

🍎 **macOS/Linux:**
```bash
rm -f datawarehouse.db
python src/database/schema.py
```

🪟 **Windows:**
```cmd
del datawarehouse.db
python src/database/schema.py
```

#### 🔑 API Connection Issues

**Problem:** API token configuration or connection problems

**Solution:**
```bash
# Check API token configuration
python main.py status --detailed

# Test API connectivity
python test_api_clients.py
```

### 🆘 Getting Help

#### Step 1: Check the Logs

- [ ] **Frontend logs:** Open browser developer console (F12)
- [ ] **Backend logs:** Check terminal output where backend server is running
- [ ] **Python ETL logs:** Check `logs/datawarehouse.log` (if configured) or terminal output

#### Step 2: Verify Configurations

- [ ] **Backend configuration:** Check `.env` file in `backend/` directory
- [ ] **Python ETL configuration:** Check `config/settings.yaml` in `datawarehouse-job/`

#### Step 3: Run Diagnostic Commands

- [ ] **System status check:**

  ```bash
  cd datawarehouse-job
  python main.py status --detailed --verbose
  ```

- [ ] **Health checks:**

  🍎 **macOS/Linux:**
  ```bash
  # API health check
  curl http://localhost:37951/health
  # Frontend check
  curl http://localhost:37950
  ```

  🪟 **Windows (PowerShell):**
  ```powershell
  # API health check
  Invoke-RestMethod http://localhost:37951/health
  # Frontend check
  Invoke-WebRequest http://localhost:37950
  ```

#### Step 4: Permission Issues

🍎 **macOS:** If you get permission denied errors:
```bash
# For Python virtual environment
chmod +x venv/bin/activate
# For npm global packages (if needed)
sudo chown -R $(whoami) ~/.npm
```

🪟 **Windows:** If you get execution policy errors in PowerShell:
```powershell
# Allow script execution (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## 📚 Next Steps

### 🚀 For Development

Now that your environment is set up, here's what to explore next:

#### 📖 Explore the Codebase

- [ ] **Frontend main component**
  - File: `/Users/jordanwashburn/Workspace/orchard9/datawarehouse/frontend/src/MarketingManagerV4.jsx`
  - What it is: Main React dashboard component

- [ ] **Backend server entry point**
  - File: `/Users/jordanwashburn/Workspace/orchard9/datawarehouse/backend/src/server.ts`
  - What it is: Express.js server with API endpoints

- [ ] **ETL pipeline components**
  - Directory: `/Users/jordanwashburn/Workspace/orchard9/datawarehouse/datawarehouse-job/src/`
  - What it is: Python modules for data processing

#### 🔄 Learn the Data Flow

1. **Python ETL** pulls data from Peach AI APIs
2. **Data stored** in SQLite with 5-tier hierarchy (Organization → Program → Campaign → Ad Set → Ad)
3. **Express.js** serves data to React frontend via REST API
4. **Frontend** displays interactive analytics dashboard

#### 🧪 Try Data Operations

- [ ] **Sync data** (requires API token)

  ```bash
  cd datawarehouse-job
  python main.py sync
  ```

- [ ] **Export data to CSV**

  ```bash
  python main.py export --format csv
  ```

- [ ] **View system status**

  ```bash
  python main.py status --detailed
  ```

### 🏭 For Production Deployment

When you're ready to deploy:

- [ ] **Environment variables:** Set up production API tokens and configurations
- [ ] **Database:** Consider PostgreSQL for production scale
- [ ] **Deployment:** Configure CI/CD pipelines
- [ ] **Monitoring:** Set up logging and monitoring systems

### 📖 Key Documentation

Essential files to reference during development:

- [ ] **`CLAUDE.md`** - Project instructions and architecture
- [ ] **`README.md`** - Project overview and technical details
- [ ] **`backend/README.md`** - Backend-specific documentation
- [ ] **`datawarehouse-job/CLAUDE.md`** - ETL system details

### 🗂️ Project Structure Reference

```
/Users/jordanwashburn/Workspace/orchard9/datawarehouse/
├── frontend/              # React + Vite (Port 37950)
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/        # Page components
│   │   ├── api/          # API integration
│   │   ├── hooks/        # Custom React hooks
│   │   └── utils/        # Utility functions
│   ├── package.json
│   └── vite.config.ts
├── backend/               # Express.js API (Port 37951)
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Express middleware
│   │   ├── services/     # Business logic
│   │   └── utils/        # Backend utilities
│   ├── package.json
│   └── .env.example
├── datawarehouse-job/     # Python ETL Pipeline
│   ├── src/
│   │   ├── api_clients/  # Peach AI API integration
│   │   ├── database/     # SQLite operations
│   │   ├── etl/          # ETL processing
│   │   ├── cli/          # Command line interface
│   │   └── exporters/    # Data export functionality
│   ├── config/
│   │   └── settings.yaml # Main configuration
│   ├── requirements.txt
│   └── main.py           # CLI entry point
└── docs/                 # Additional documentation
```

---

## 🎉 Congratulations!

**Welcome to Orchard9 Data Warehouse development!**

This platform empowers marketing teams with deep insights into campaign performance across the entire customer journey. You're now ready to start building amazing data-driven features.

### ✅ Final Setup Checklist

- [ ] All prerequisites installed and verified
- [ ] Repository cloned and directory structure confirmed
- [ ] All three components (Frontend, Backend, Python ETL) set up successfully
- [ ] Database initialized and verified
- [ ] All development servers running
- [ ] Application verified working in browser

### 🆘 Need Help?

For questions or issues:
1. Check the [troubleshooting section](#troubleshooting) above
2. Review detailed documentation in `CLAUDE.md` and component-specific README files
3. Run diagnostic commands to identify specific issues

**Happy coding! 🚀**