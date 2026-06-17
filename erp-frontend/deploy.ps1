# Deploy Script - ERP Frontend to Cloudflare Pages
Write-Host "Building project..." -ForegroundColor Cyan
cd D:\OpenCode\ERP\erp-frontend
npm run build

Write-Host "Deploying to Cloudflare Pages..." -ForegroundColor Cyan
# Set CLOUDFLARE_API_TOKEN in your environment before running this script
npx wrangler pages deploy dist --project-name alfanar

Write-Host "Deployment complete!" -ForegroundColor Green