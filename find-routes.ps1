$path = "apps\web\app"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}
Get-ChildItem -Path $path -Directory -Recurse | ForEach-Object {
    $rel = $_.FullName.Substring((Resolve-Path $path).Path.Length)
    Write-Host $rel
}
