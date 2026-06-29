# setup-replica-set.ps1
# Configures local MongoDB as a single-node replica set (rs0)
# Run this as Administrator once

param()

$ErrorActionPreference = "Stop"

Write-Host "`n[1/5] Updating mongod.cfg..." -ForegroundColor Cyan

$cfgPath = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"
$cfg = Get-Content $cfgPath -Raw

# Replace #replication: with replica set config
if ($cfg -match "replication:\s*\r?\n\s*replSetName:") {
    Write-Host "       Replica set already configured." -ForegroundColor Yellow
} else {
    $cfg = $cfg -replace '#replication:', "replication:`r`n  replSetName: `"rs0`""
    Set-Content $cfgPath -Value $cfg -NoNewline
    Write-Host "       mongod.cfg updated." -ForegroundColor Green
}

Write-Host "[2/5] Restarting MongoDB service..." -ForegroundColor Cyan
Restart-Service MongoDB
Start-Sleep -Seconds 5
Write-Host "       MongoDB service restarted." -ForegroundColor Green

Write-Host "[3/5] Initializing replica set rs0..." -ForegroundColor Cyan
$initScript = 'rs.status().ok == 1 ? print("ALREADY_INIT") : rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
$result = & "C:\Program Files\MongoDB\Server\8.2\bin\mongosh.exe" --quiet --eval $initScript 2>&1

if ($result -match "ALREADY_INIT" -or $result -match '"ok" : 1' -or $result -match "ok: 1") {
    Write-Host "       Replica set already initialized or init succeeded." -ForegroundColor Green
} else {
    # Try with mongo if mongosh not found
    Write-Host "       Result: $result" -ForegroundColor Gray
    Write-Host "       Waiting for rs0 to stabilize..." -ForegroundColor Gray
}

Start-Sleep -Seconds 3

Write-Host "[4/5] Verifying replica set..." -ForegroundColor Cyan
$status = & "C:\Program Files\MongoDB\Server\8.2\bin\mongosh.exe" --quiet --eval 'rs.status().myState' 2>&1
Write-Host "       Replica set state: $status" -ForegroundColor Gray

Write-Host "[5/5] Done! Update .env connection strings now." -ForegroundColor Green
Write-Host ""
Write-Host "  Add ?replicaSet=rs0 to your MongoDB URLs in .env:" -ForegroundColor Yellow
Write-Host "  DATABASE_URL=mongodb://localhost:27017/okjt100-loadtest?replicaSet=rs0" -ForegroundColor White
Write-Host "  LOAD_TEST_DB=mongodb://localhost:27017/okjt100-loadtest?replicaSet=rs0" -ForegroundColor White
Write-Host ""
