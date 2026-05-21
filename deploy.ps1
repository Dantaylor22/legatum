# Digital Relative — One-click deploy script
# Run this after downloading and extracting a new zip from Claude
# Usage: .\deploy.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Digital Relative Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: Run this script from the legatum folder" -ForegroundColor Red
    exit 1
}

# Step 1: npm audit
Write-Host "Step 1/5: Security audit..." -ForegroundColor Yellow
npm audit --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED: Vulnerabilities found. Fix before deploying." -ForegroundColor Red
    exit 1
}
Write-Host "  Clean - no vulnerabilities" -ForegroundColor Green

# Step 2: Install dependencies
Write-Host "Step 2/5: Installing dependencies..." -ForegroundColor Yellow
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED: npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Done" -ForegroundColor Green

# Step 3: Build
Write-Host "Step 3/5: Building..." -ForegroundColor Yellow
$proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run build > `"$env:TEMP\dr_build_out.txt`" 2>&1" -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) {
    Write-Host "  FAILED: Build errors:" -ForegroundColor Red
    Get-Content "$env:TEMP\dr_build_out.txt" | Select-String -NotMatch "^$" | Write-Host
    exit 1
}
Write-Host "  Build passed" -ForegroundColor Green

# Step 4: Commit and push
Write-Host "Step 4/5: Committing..." -ForegroundColor Yellow
$changes = git status --porcelain
if (-not $changes) {
    Write-Host "  No changes to deploy" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
$msg = Read-Host "  Enter commit message"
if (-not $msg) { $msg = "Deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }

git add . 2>$null
git commit -m $msg --quiet 2>$null
git push --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host "  FAILED: Git push failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Pushed - Vercel will auto-deploy frontend" -ForegroundColor Green

# Step 5: Deploy changed edge functions
Write-Host "Step 5/5: Edge functions..." -ForegroundColor Yellow
$changedFunctions = git diff HEAD~1 --name-only 2>$null | Where-Object { $_ -match "supabase/functions/([^/]+)/index\.ts" -and $_ -notmatch "_shared" }

if (-not $changedFunctions) {
    Write-Host "  No edge function changes" -ForegroundColor Green
} else {
    $deployed = @()
    foreach ($file in $changedFunctions) {
        if ($file -match "supabase/functions/([^/]+)/index\.ts") {
            $fn = $matches[1]
            if ($fn -notin $deployed) {
                $deployed += $fn
                Write-Host "  Deploying $fn..." -ForegroundColor Yellow
                if ($fn -eq "stripe-webhook") {
                    supabase functions deploy stripe-webhook --no-verify-jwt 2>&1 | Out-Null
                } else {
                    supabase functions deploy $fn 2>&1 | Out-Null
                }
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  $fn deployed" -ForegroundColor Green
                } else {
                    Write-Host "  WARNING: $fn failed - deploy manually" -ForegroundColor Red
                }
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All done!" -ForegroundColor Green
Write-Host "  Site: https://digitalrelative.co.uk" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
