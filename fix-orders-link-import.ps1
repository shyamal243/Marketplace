$path = "apps\web\app\orders\[id]\page.tsx"
if (-not (Test-Path -LiteralPath $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

$old = @'
import { useEffect, useState, use } from "react";
import { apiFetch } from "../../lib/api";
'@

$new = @'
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
'@

$oldN = $old.Replace("`r`n", "`n")
$newN = $new.Replace("`r`n", "`n")

if ($content.Contains($oldN)) {
    $updated = $content.Replace($oldN, $newN)
    if ($hadCrLf) { $updated = $updated.Replace("`n", "`r`n") }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $path).Path, $updated, $utf8NoBom)
    Write-Host "Fixed: added the missing 'next/link' import." -ForegroundColor Green
} else {
    Write-Host "Anchor not found. Current top of file:" -ForegroundColor Red
    Write-Host $content.Substring(0, [Math]::Min(400, $content.Length))
}
