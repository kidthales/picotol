<#
.SYNOPSIS
    Runs the single-source-of-truth continuous integration suite for @kidthales/picotol.
.DESCRIPTION
    Executes the full test and verification pipeline locally and in GitHub Actions with 1:1 parity:
    0. Workflow single-source-of-truth drift audit (.github/workflows/*.yml)
    1. Agent & scratch file leak audit (tracked & untracked)
    2. PowerShell AST parse validation (*.ps1)
    3. Generated distribution drift audit (npm run generate -> git status --porcelain dist src data README.md)
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
$Gate0Status = "fail"
$Gate1ActionPinsStatus = "fail"
$Gate1Status = "fail"
$Gate2Status = "fail"
$Gate3Status = "fail"
$Gate4Status = "fail"

Push-Location $RootDir
try {
    $NodeVersionRaw = (& node -p "process.versions.node").Trim()
    $NodeVersionCore = ($NodeVersionRaw -split '[-+]')[0]
    if ([System.Version]$NodeVersionCore -lt [System.Version]"22.2.0") {
        throw "Node.js >= 22.2.0 is required (for zlib.crc32); found $NodeVersionRaw."
    }

    # -------------------------------------------------------------
    # Gate 0: Workflow Single-Source-of-Truth Drift Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 0 $MaxGate "Auditing GitHub Actions workflows for CI drift (Node YAML parser)"

    $WorkflowCheckPath = Join-Path $RootDir "tools/check-workflows.mjs"
    $WorkflowCheckOutput = & node $WorkflowCheckPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        foreach ($err in $WorkflowCheckOutput) {
            Write-Fail $err
        }
        throw "Gate 0 Failed: Workflow drift detected. scripts/ci-local.ps1 must remain the sole source of CI test truth."
    }

    $Gate0Status = "pass"
    $Gate1ActionPinsStatus = "pass"
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

    # Check for private downstream repository references in public documentation
    $ReadmeFile = Join-Path $RootDir "README.md"
    if (Test-Path $ReadmeFile) {
        $readmeText = Get-Content -Path $ReadmeFile -Raw
        if ($readmeText -match 'kidthales/foundation') {
            Write-Fail "README.md references private downstream 'kidthales/foundation' (A11 violation)."
            $HasLeak = $true
        }
    }

    if ($HasLeak) {
        throw "Gate 1 Failed: Agent files, scratch artifacts, or private repository references detected."
    }

    $Gate1Status = "pass"
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

    $Gate2Status = "pass"
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

        $DriftPaths = @('dist', 'src', 'data', 'README.md')
        $DistStatus = & git status --porcelain -- $DriftPaths
        if ($DistStatus) {
            Write-Fail "Generated files ($($DriftPaths -join ', ')) differ from a fresh generation. Run 'npm run generate' and commit the result."
            Write-Host "Drift details:" -ForegroundColor Red
            & git status --porcelain -- $DriftPaths
            & git diff --stat -- $DriftPaths
            throw "Gate 3 Failed: Generated distribution drift detected."
        }

        $Gate3Status = "pass"
        Exit-GatePass "Generated outputs are up to date and clean." $StepTimer
    } else {
        $Gate3Status = "not-applicable"
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

    $PreTestStatus = (& git status --porcelain | Out-String)
    Write-Host "  -> Running npm test (lint + check:budgets + node --test)..." -ForegroundColor DarkGray
    & npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm test failed with exit code $LASTEXITCODE."
        throw "Gate 4 Failed: Composite test suite (npm test) failed."
    }

    # Verify working tree remains 100% clean and side-effect-free after npm test
    $PostTestStatus = (& git status --porcelain | Out-String)
    if ($PostTestStatus -ne $PreTestStatus) {
        Write-Fail "Working tree was mutated by 'npm test'. Tests must be strictly read-only and side-effect-free."
        Write-Host "Dirty files produced by tests:" -ForegroundColor Red
        & git status --porcelain
        throw "Gate 4 Failed: Tests produced working tree side effects."
    }
    if ($IsCI -and $PostTestStatus.Trim() -ne "") {
        Write-Fail "Working tree is dirty in CI after 'npm test' (git status must be clean)."
        Write-Host "Dirty files:" -ForegroundColor Red
        & git status --porcelain
        throw "Gate 4 Failed: Working tree must be clean after npm test."
    }

    if (-not $Quick) {
        Write-Host "  -> Running npm pack --dry-run..." -ForegroundColor DarkGray
        & npm pack --dry-run
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm pack --dry-run failed with exit code $LASTEXITCODE."
            throw "Gate 4 Failed: Package packaging dry-run failed."
        }
        $Gate4Status = "pass"
    } else {
        $Gate4Status = "not-applicable"
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
            # seldon ci receipt requires explicit --gates statuses to record .ci-local/receipt.json for --local-ci review gates
            Write-Host "`n[Receipt] Recording local CI receipt via seldon ci receipt..." -ForegroundColor Yellow
            $GateResults = @(
                "gate0_workflow_contract=$Gate0Status",
                "gate1_action_pins=$Gate1ActionPinsStatus",
                "gate1_agent_leaks=$Gate1Status",
                "gate2_go_vet=not-applicable",
                "gate2_pwsh_ast=$Gate2Status",
                "gate3_dist_drift=$Gate3Status",
                "gate3_unit_coverage=not-applicable",
                "gate4_govulncheck=not-applicable",
                "gate4_npm_test_and_pack=$Gate4Status",
                "gate5_race_detector=not-applicable",
                "gate6_pwsh_ast=not-applicable",
                "gate7_knowledge_budget=not-applicable",
                "gate8_secret_leaks=not-applicable",
                "gate9_cross_compile=not-applicable"
            )
            $ReceiptArgs = @(
                "ci", "receipt",
                "--dir", $RootDir,
                "--script-path", "scripts/ci-local.ps1",
                "--gates", ($GateResults -join ",")
            )
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
