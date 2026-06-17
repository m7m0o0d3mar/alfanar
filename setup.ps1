# 🏗️ ERP Construction - PowerShell Setup Script
# Run this AFTER creating Supabase project and .env file

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  🏗️  ERP Construction - Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 التأكد من وجود ملف .env..."
$envFile = Join-Path $PSScriptRoot "erp-frontend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "❌ ملف .env غير موجود!" -ForegroundColor Red
    Write-Host "الرجاء إنشاء ملف .env في المجلد erp-frontend" -ForegroundColor Yellow
    Write-Host "مثال:" -ForegroundColor Yellow
    Write-Host "  VITE_SUPABASE_URL=https://xxxxx.supabase.co" -ForegroundColor Gray
    Write-Host "  VITE_SUPABASE_ANON_KEY=eyJxxx..." -ForegroundColor Gray
    pause
    exit 1
}
Write-Host "✅ ملف .env موجود" -ForegroundColor Green

Write-Host ""
Write-Host "📦 [1/3] تثبيت الحزم (npm install)..."
Set-Location (Join-Path $PSScriptRoot "erp-frontend")
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل التثبيت. تأكد من تثبيت Node.js" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ تم تثبيت الحزم" -ForegroundColor Green

Write-Host ""
Write-Host "🔨 [2/3] بناء التطبيق (npm run build)..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ فشل البناء" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "✅ تم بناء التطبيق في مجلد dist" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 [3/3] تشغيل التطبيق..."
Write-Host ""
Write-Host "📌 افتح المتصفح على: http://localhost:5173" -ForegroundColor Yellow
Write-Host "📌 اضغط Ctrl+C لإيقاف الخادم" -ForegroundColor Yellow
Write-Host ""
Start-Process "http://localhost:5173"
npm run dev

pause
