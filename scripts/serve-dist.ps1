param(
  [int]$Port = 4173,
  [string]$RootDir = ".\dist"
)

$ErrorActionPreference = "Stop"

$rootPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $RootDir))
if (-not (Test-Path -LiteralPath $rootPath)) {
  throw "Static root not found: $rootPath"
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

Write-Host ""
Write-Host "Neon Snake static server is running."
Write-Host "Root : $rootPath"
Write-Host "Open : http://127.0.0.1:$Port/"
Write-Host "Press Ctrl+C to stop."
Write-Host ""

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico"  = "image/x-icon"
  ".txt"  = "text/plain; charset=utf-8"
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = $context.Request.Url.AbsolutePath
    if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq "/") {
      $requestPath = "/index.html"
    }

    $trimmed = $requestPath.TrimStart("/") -replace "/", [System.IO.Path]::DirectorySeparatorChar
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $rootPath $trimmed))

    if (-not $candidate.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not (Test-Path -LiteralPath $candidate)) {
      $fallback = Join-Path $rootPath "index.html"
      if (Test-Path -LiteralPath $fallback) {
        $candidate = $fallback
      } else {
        $context.Response.StatusCode = 404
        $context.Response.Close()
        continue
      }
    }

    $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
    $contentType = $contentTypes[$extension]
    if (-not $contentType) {
      $contentType = "application/octet-stream"
    }

    $bytes = [System.IO.File]::ReadAllBytes($candidate)
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.OutputStream.Close()
  }
}
finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
