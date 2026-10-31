function Dump-File($path) {
    if (Test-Path $path) {
        Write-Host "===== $path =====" -ForegroundColor Cyan
        Write-Host ([System.IO.File]::ReadAllText((Resolve-Path $path).Path))
        Write-Host ""
    } else {
        Write-Host "===== $path (NOT FOUND) =====" -ForegroundColor Yellow
        Write-Host ""
    }
}

Dump-File "apps\web\tailwind.config.js"
Dump-File "apps\web\tailwind.config.ts"
Dump-File "apps\web\postcss.config.js"
Dump-File "apps\web\postcss.config.mjs"
Dump-File "apps\web\app\globals.css"
