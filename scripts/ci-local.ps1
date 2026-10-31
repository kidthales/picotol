<#
.SYNOPSIS
    Runs the single-source-of-truth continuous integration suite for @kidthales/picotol.
.DESCRIPTION
    Executes the full test and verification pipeline locally and in GitHub Actions with 1:1 parity:
    0. Workflow single-source-of-truth drift audit (.github/workflows/*.yml)
    1. Agent & scratch file leak audit (tracked & untracked)
    2. PowerShell AST parse validation (*.ps1)
    3. Generated distribution drift audit (npm run generate -> git status --porcelain dist)
    4. Composite test suite (npm test: lint + budgets + node --test) & packaging dry-run (npm pack --dry-run)
.PARAMETER Quick
    Runs without Gate 3 distribution regeneration and Gate 4 npm pack --dry-run. Forbidden in -CI mode.
.PARAMETER SkipGenerate
    Skips Gate 3 distribution regeneration and drift verification. Forbidden in -CI mode.
.PARAMETER CI
    Enables strict CI mode (auto-enabled when $env:GITHUB_ACTIONS is set): rejects -Quick and -SkipGenerate,
    emits GitHub Actions ::group::/::endgroup:: and ::error:: annotations, and guarantees non-zero exit on failure.
.EXAMPLE
    pwsh ./scripts/ci-local.ps1
    pwsh ./scripts/ci-local.ps1 -Quick
    pwsh ./scripts/ci-local.ps1 -CI
#>
[CmdletBinding()]
param(
    [switch]$Quick,
    [switch]$SkipGenerate,
    [switch]$CI
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$IsCI = $CI.IsPresent -or (-not [string]::IsNullOrWhiteSpace($env:GITHUB_ACTIONS))
$script:InGroup = $false

$TotalTimer = [System.Diagnostics.Stopwatch]::StartNew()

function Enter-Gate([int]$Gate, [int]$MaxGate, [string]$Title) {
    $Header = "[Gate $Gate/$MaxGate] $Title"
    if ($IsCI) {
        Write-Host "::group::$Header"
        $script:InGroup = $true
    } else {
        Write-Host "`n$Header..." -ForegroundColor Yellow
    }
}

function Exit-GatePass([string]$Message, [System.Diagnostics.Stopwatch]$Timer) {
    $elapsed = [math]::Round($Timer.Elapsed.TotalSeconds, 2)
    Write-Host "  -> [OK] $Message (${elapsed}s)" -ForegroundColor Green
    if ($IsCI -and $script:InGroup) {
        Write-Host "::endgroup::"
        $script:InGroup = $false
    }
}

function Write-Fail([string]$Message) {
    if ($IsCI) {
        Write-Host "::error::$Message"
    }
    Write-Host "  -> [FAIL] $Message" -ForegroundColor Red
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " picotol Single-Source-of-Truth CI Pipeline$(if ($IsCI) { ' [CI Mode]' } else { '' })" -ForegroundColor Cyan
Write-Host " Root: $RootDir" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan

if ($IsCI -and ($Quick -or $SkipGenerate)) {
    Write-Fail "CI mode forbids -Quick and -SkipGenerate flags; the full verification pipeline must execute."
    exit 1
}

$MaxGate = 4

Push-Location $RootDir
try {
    # -------------------------------------------------------------
    # Gate 0: Workflow Single-Source-of-Truth Drift Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 0 $MaxGate "Auditing GitHub Actions workflows for CI drift"

    $WorkflowDir = Join-Path $RootDir ".github/workflows"
    $WorkflowFiles = @()
    if (Test-Path $WorkflowDir) {
        $WorkflowFiles = @(Get-ChildItem -Path $WorkflowDir -File | Where-Object { $_.Extension -in @('.yml', '.yaml') })
    }

    $DriftErrors = [System.Collections.Generic.List[string]]::new()
    if ($WorkflowFiles.Count -eq 0) {
        $DriftErrors.Add("No workflow files found in .github/workflows/.")
    }

    $ForbiddenRunPattern = '\b(npm\s+(test|t|tst|run\s+test|run\s+lint|run\s+check:budgets|pack)|node\s+--test)\b'
    $CiInvokesScript = $false
    $ReleaseUsesCiWorkflow = $false

    foreach ($wf in $WorkflowFiles) {
        $lines = Get-Content -Path $wf.FullName
        $inRunBlock = $false
        $runBaseIndent = 0

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            $lineNum = $i + 1

            if ($wf.Name -eq 'release.yml' -and $line -match '^\s*uses\s*:\s*\./\.github/workflows/ci\.yml\s*$') {
                $ReleaseUsesCiWorkflow = $true
            }

            if ($inRunBlock) {
                if ($line -match '^\s*$') {
                    continue
                }
                $line -match '^(?<sp>\s*)' | Out-Null
                $currentIndent = $Matches['sp'].Length
                if ($currentIndent -le $runBaseIndent) {
                    $inRunBlock = $false
                } else {
                    if ($line -notmatch '^\s*#') {
                        if ($line -match $ForbiddenRunPattern) {
                            $DriftErrors.Add("$($wf.Name):$lineNum invokes forbidden verification command in 'run:': '$($line.Trim())'")
                        }
                        if ($line -match '\bnpm\s+run\s+(?<script>[a-zA-Z0-9:_-]+)') {
                            $npmScript = $Matches['script']
                            if (-not ($npmScript -eq 'build' -and $wf.Name -in @('pages.yml', 'release.yml'))) {
                                $DriftErrors.Add("$($wf.Name):$lineNum invokes unapproved 'npm run $npmScript' in 'run:' (only artifact 'npm run build' in pages.yml/release.yml is allowed)")
                            }
                        }
                        if ($wf.Name -eq 'ci.yml' -and $line -match 'pwsh\b.*scripts/ci-local\.ps1') {
                            $CiInvokesScript = $true
                        }
                    }
                    continue
                }
            }

            if ($line -match '^(?<indent>\s*)(?:-\s*)?run\s*:\s*(?<val>.*)$') {
                $runBaseIndent = $Matches['indent'].Length
                $val = $Matches['val'].Trim()
                if ($val -match '^[|>][-+]?\s*(#.*)?$') {
                    $inRunBlock = $true
                } elseif ($val -ne '' -and $val -notmatch '^#') {
                    if ($val -match $ForbiddenRunPattern) {
                        $DriftErrors.Add("$($wf.Name):$lineNum invokes forbidden verification command in 'run:': '$val'")
                    }
                    if ($val -match '\bnpm\s+run\s+(?<script>[a-zA-Z0-9:_-]+)') {
                        $npmScript = $Matches['script']
                        if (-not ($npmScript -eq 'build' -and $wf.Name -in @('pages.yml', 'release.yml'))) {
                            $DriftErrors.Add("$($wf.Name):$lineNum invokes unapproved 'npm run $npmScript' in 'run:' (only artifact 'npm run build' in pages.yml/release.yml is allowed)")
                        }
                    }
                    if ($wf.Name -eq 'ci.yml' -and $val -match 'pwsh\b.*scripts/ci-local\.ps1') {
                        $CiInvokesScript = $true
                    }
                }
            }
        }
    }

    if (-not $CiInvokesScript) {
        $DriftErrors.Add("ci.yml must invoke 'pwsh ./scripts/ci-local.ps1 -CI' in a 'run:' step.")
    }
    if (-not $ReleaseUsesCiWorkflow) {
        $DriftErrors.Add("release.yml must delegate verification via 'uses: ./.github/workflows/ci.yml'.")
    }

    if ($DriftErrors.Count -gt 0) {
        foreach ($err in $DriftErrors) {
            Write-Fail $err
        }
        throw "Gate 0 Failed: Workflow drift detected ($($DriftErrors.Count) violation(s)). scripts/ci-local.ps1 must remain the sole source of CI test truth."
    }

    Exit-GatePass "All workflows delegate verification to scripts/ci-local.ps1 with zero drift." $StepTimer

    # -------------------------------------------------------------
    # Gate 1: Agent & Scratch File Leak Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 1 $MaxGate "Auditing for agent & scratch file leaks"

    $AgentFilePattern = '^(\.agents?/|\.gemini/|\.ai/|\.cursor/|\.claude/|scratch/|docs/learnings/|AGENTS\.md$|GEMINI\.md$|CLAUDE\.md$)'

    # Check tracked files in git
    $TrackedFiles = & git ls-files
    $TrackedLeaks = @($TrackedFiles | Where-Object { $_ -match $AgentFilePattern })

    # Check untracked files
    $UntrackedFiles = & git ls-files --others --exclude-standard
    $UntrackedLeaks = @($UntrackedFiles | Where-Object { $_ -match $AgentFilePattern })

    $HasLeak = $false
    if ($TrackedLeaks.Count -gt 0) {
        Write-Fail "Tracked agent or scratch files detected in git:"
        foreach ($file in $TrackedLeaks) {
            Write-Host "     * $file" -ForegroundColor Red
        }
        $HasLeak = $true
    }

    if ($UntrackedLeaks.Count -gt 0) {
        Write-Fail "Untracked agent or scratch files detected in workspace:"
        foreach ($file in $UntrackedLeaks) {
            Write-Host "     * $file" -ForegroundColor Red
        }
        $HasLeak = $true
    }

    if ($HasLeak) {
        throw "Gate 1 Failed: Agent or scratch files must not exist or be tracked in the repository."
    }

    Exit-GatePass "No tracked or untracked agent files detected." $StepTimer

    # -------------------------------------------------------------
    # Gate 2: PowerShell AST Parse Validation
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 2 $MaxGate "Running PowerShell AST parse validation (*.ps1)"

    $Ps1Files = Get-ChildItem -Path $RootDir -Recurse -Filter "*.ps1" | Where-Object { $_.FullName -notmatch '[\\/](\.git|node_modules)[\\/]' }
    $ParseErrors = 0
    foreach ($ps in $Ps1Files) {
        $tokens = $null
        $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile($ps.FullName, [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count -gt 0) {
            Write-Fail "Parse error in $($ps.FullName): $($errors | Out-String)"
            $ParseErrors++
        }
    }
    if ($ParseErrors -gt 0) {
        throw "Gate 2 Failed: $ParseErrors PowerShell script(s) failed AST parse validation."
    }

    Exit-GatePass "PowerShell AST validation passed ($($Ps1Files.Count) script(s))." $StepTimer

    # -------------------------------------------------------------
    # Gate 3: Generated Distribution Drift Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 3 $MaxGate "Verifying generated distribution outputs are up to date"

    if (-not $SkipGenerate -and -not $Quick) {
        Write-Host "  -> Running npm run generate..." -ForegroundColor DarkGray
        & npm run generate
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm run generate failed with exit code $LASTEXITCODE."
            throw "Gate 3 Failed: Distribution generation failed."
        }

        $DistStatus = & git status --porcelain dist
        if ($DistStatus) {
            Write-Fail "dist/ differs from a fresh generation. Run 'npm run generate' and commit the result."
            Write-Host "Drift details:" -ForegroundColor Red
            & git status --porcelain dist
            & git diff --stat dist
            throw "Gate 3 Failed: Generated distribution drift detected."
        }

        Exit-GatePass "Generated outputs are up to date and clean." $StepTimer
    } else {
        Write-Host "  -> Skipping distribution regeneration (-SkipGenerate or -Quick)." -ForegroundColor Gray
        if ($IsCI -and $script:InGroup) {
            Write-Host "::endgroup::"
            $script:InGroup = $false
        }
    }

    # -------------------------------------------------------------
    # Gate 4: Composite Test Suite & Packaging Verification
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 4 $MaxGate "Running composite test suite (npm test) and packaging verification (npm pack --dry-run)"

    Write-Host "  -> Running npm test (lint + check:budgets + node --test)..." -ForegroundColor DarkGray
    & npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm test failed with exit code $LASTEXITCODE."
        throw "Gate 4 Failed: Composite test suite (npm test) failed."
    }

    if (-not $Quick) {
        Write-Host "  -> Running npm pack --dry-run..." -ForegroundColor DarkGray
        & npm pack --dry-run
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm pack --dry-run failed with exit code $LASTEXITCODE."
            throw "Gate 4 Failed: Package packaging dry-run failed."
        }
    } else {
        Write-Host "  -> Skipping npm pack --dry-run (-Quick)." -ForegroundColor Gray
    }

    Exit-GatePass "Composite test suite and packaging verification passed." $StepTimer

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    $TotalElapsed = [math]::Round($TotalTimer.Elapsed.TotalSeconds, 2)
    Write-Host "`n====================================================" -ForegroundColor Green
    Write-Host " All CI Verification Checks PASSED (${TotalElapsed}s)" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Cyan

    # -------------------------------------------------------------
    # Write Verifiable Local CI Receipt (.ci-local/receipt.json)
    # -------------------------------------------------------------
    # Skipped under -CI mode or when seldon is absent.
    if ($IsCI) {
        Write-Host "`n  -> Skipping local CI receipt generation under -CI mode." -ForegroundColor Gray
    } else {
        $SeldonBin = $null
        if ($env:SELDON_BIN) {
            if ($env:SELDON_BIN -ne "none" -and (Test-Path $env:SELDON_BIN)) {
                $SeldonBin = $env:SELDON_BIN
            }
        } else {
            $PathCmd = Get-Command "seldon" -ErrorAction SilentlyContinue
            if ($PathCmd) {
                $SeldonBin = $PathCmd.Source
            }
        }

        if (-not $SeldonBin) {
            Write-Host "`n  -> Skipping local CI receipt generation (seldon binary not found)." -ForegroundColor Gray
        } else {
            Write-Host "`n[Receipt] Recording local CI receipt via seldon ci receipt..." -ForegroundColor Yellow
            $ReceiptArgs = @("ci", "receipt", "--dir", $RootDir, "--script-path", "scripts/ci-local.ps1")
            $ActiveFlags = @()
            if ($Quick) { $ActiveFlags += "-Quick" }
            if ($SkipGenerate) { $ActiveFlags += "-SkipGenerate" }
            if ($ActiveFlags.Count -gt 0) {
                $ReceiptArgs += @("--flags", ($ActiveFlags -join ","))
            }
            & $SeldonBin @ReceiptArgs
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to write local CI receipt via seldon ci receipt."
            }
            Write-Host "  -> Local CI receipt written to .ci-local/receipt.json." -ForegroundColor Green
        }
    }
} catch {
    if ($IsCI -and $script:InGroup) {
        Write-Host "::endgroup::"
        $script:InGroup = $false
    }
    Write-Fail $_.Exception.Message
    exit 1
} finally {
    Pop-Location
}
