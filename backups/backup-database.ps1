# Database backup script for reverse-marketplace
# Designed to run unattended on a server (e.g. via cron or a scheduled task)
# Reads PGPASSWORD from the .env file at the project root

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^PGPASSWORD=(.*)$") {
            $env:PGPASSWORD = $matches[1]
        }
    }
}

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = "$PSScriptRoot/backup_$timestamp.sql"

Write-Host "Backing up database to $backupFile ..."

pg_dump -h 127.0.0.1 -p 5432 -U postgres -d reverse_marketplace -f $backupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully: $backupFile"
} else {
    Write-Host "Backup failed. Check the error above."
}

$allBackups = Get-ChildItem -Path $PSScriptRoot -Filter "backup_*.sql" | Sort-Object LastWriteTime -Descending
if ($allBackups.Count -gt 10) {
    $allBackups | Select-Object -Skip 10 | Remove-Item -Force
    Write-Host "Cleaned up old backups, keeping the 10 most recent."
}
