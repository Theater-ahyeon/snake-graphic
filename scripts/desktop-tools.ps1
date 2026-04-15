param(
  [ValidateSet("run", "pack")]
  [string]$Action = "run"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

function Get-PnpmCommand {
  $candidates = @(
    (Join-Path $env:APPDATA "npm\pnpm.cmd"),
    (Join-Path $env:APPDATA "npm\pnpm.ps1")
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return @($candidate)
    }
  }

  $pnpmCmd = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($pnpmCmd) {
    return @($pnpmCmd.Source)
  }

  $corepackCmd = Join-Path $env:ProgramFiles "nodejs\corepack.cmd"
  if (Test-Path $corepackCmd) {
    return @($corepackCmd, "pnpm")
  }

  throw "未找到 pnpm，请先安装 Node.js + pnpm。"
}

function Invoke-Pnpm {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $commandParts = Get-PnpmCommand
  $command = $commandParts[0]
  $prefix = @()
  if ($commandParts.Count -gt 1) {
    $prefix = $commandParts[1..($commandParts.Count - 1)]
  }

  & $command @prefix @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm 执行失败：$($Arguments -join ' ')"
  }
}

if (-not (Test-Path (Join-Path $repoRoot "node_modules"))) {
  Write-Host "[Neon Snake Studio] 首次运行，正在安装依赖..." -ForegroundColor Cyan
  Invoke-Pnpm -Arguments @("install")
}

if ($Action -eq "pack") {
  Write-Host "[Neon Snake Studio] 正在打包桌面版..." -ForegroundColor Cyan
  Invoke-Pnpm -Arguments @("desktop:pack")
  Write-Host "[Neon Snake Studio] 打包完成，产物位于 release 目录。" -ForegroundColor Green
  exit 0
}

Write-Host "[Neon Snake Studio] 正在启动桌面版..." -ForegroundColor Cyan
Invoke-Pnpm -Arguments @("desktop")
