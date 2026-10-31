$path = "apps\api\src\index.ts"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$content = Get-Content $path -Raw
$lines = Get-Content $path

function Show-Snippet {
    param($label, $idx, $len = 2500)
    Write-Host ""
    Write-Host "===== $label =====" -ForegroundColor Cyan
    if ($idx -eq -1) {
        Write-Host "(not found)" -ForegroundColor Yellow
    } else {
        Write-Host $content.Substring($idx, [Math]::Min($len, $content.Length - $idx))
    }
}

# Find all route definitions that look like promote/demote
$idx1 = $content.IndexOf("co-admin")
$idx1 = $content.IndexOf("promote")
Show-Snippet "First 'promote' occurrence" $idx1 2500

$idx2 = $content.IndexOf("demote")
Show-Snippet "First 'demote' occurrence" $idx2 2000

$idx3 = $content.IndexOf("make-employee")
Show-Snippet "make-employee route (if separate)" $idx3 1500

Write-Host ""
Write-Host "===== Line numbers containing 'updated' near role-update code =====" -ForegroundColor Cyan
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match 'updated' -and ($lines[$i] -match 'role' -or $lines[$i-1] -match 'role' -or $lines[$i+1] -match 'role')) {
        Write-Host ("Line {0}: {1}" -f ($i + 1), $lines[$i])
    }
}
