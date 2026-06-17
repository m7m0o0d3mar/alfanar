@echo off
echo ============================================
echo  🏗️  ERP Construction - Setup
echo ============================================
echo.
echo هذا السكريبت سيساعدك في تجهيز التطبيق
echo.
echo IMPORTANT: Before running this:
echo  1. Create Supabase project (supabase.com)
echo  2. Run SQL files in Supabase SQL Editor
echo  3. Create .env file with your Supabase keys
echo.
echo Press any key to continue...
pause > nul

echo.
echo [1/3] Installing Node.js dependencies...
cd /d "%~dp0erp-frontend"
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed. Make sure Node.js is installed.
    pause
    exit /b 1
)
echo Done!
echo.

echo [2/3] Building for production...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed. Check for errors above.
    pause
    exit /b 1
)
echo Done!
echo.

echo [3/3] Starting development server...
echo.
echo The app will open at http://localhost:5173
echo Press Ctrl+C to stop the server.
echo.
start http://localhost:5173
call npm run dev

pause
