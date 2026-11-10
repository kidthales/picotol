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
    Enables strict CI mode (auto-enabled when $env:GITHUB_ACTIONS is set): rejects -Quick, -SkipGenerate,
    -Gate0Only, and -WorkflowsPath flags, emits GitHub Actions ::group::/::endgroup:: and ::error:: annotations,
    and guarantees non-zero exit on failure.
.PARAMETER Gate0Only
    Runs Gate 0 workflow single-source-of-truth drift audit only and exits. Forbidden in -CI mode.
.PARAMETER WorkflowsPath
    Custom path to workflow directory to audit in Gate 0. Requires -Gate0Only. Forbidden in -CI mode.
.EXAMPLE
    pwsh ./scripts/ci-local.ps1
    pwsh ./scripts/ci-local.ps1 -Quick
    pwsh ./scripts/ci-local.ps1 -CI
    pwsh ./scripts/ci-local.ps1 -Gate0Only
    pwsh ./scripts/ci-local.ps1 -Gate0Only -WorkflowsPath ./custom/workflows
#>
[CmdletBinding()]
param(
    [switch]$Quick,
    [switch]$SkipGenerate,
    [switch]$CI,
    [switch]$Gate0Only,
    [string]$WorkflowsPath = ""
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

if ($IsCI) {
    $rejectedFlags = @()
    if ($Quick) { $rejectedFlags += "-Quick" }
    if ($SkipGenerate) { $rejectedFlags += "-SkipGenerate" }
    if ($Gate0Only) { $rejectedFlags += "-Gate0Only" }
    if ($PSBoundParameters.ContainsKey('WorkflowsPath')) { $rejectedFlags += "-WorkflowsPath" }
    if ($rejectedFlags.Count -gt 0) {
        Write-Fail "CI mode forbids $($rejectedFlags -join ', ') flags; the full verification pipeline must execute."
        exit 1
    }
}

if ($PSBoundParameters.ContainsKey('WorkflowsPath')) {
    if ([string]::IsNullOrWhiteSpace($WorkflowsPath)) {
        Write-Fail "-WorkflowsPath requires a non-empty directory path."
        exit 1
    }
    if (-not $Gate0Only) {
        Write-Fail "-WorkflowsPath requires -Gate0Only; full pipeline runs must audit the canonical .github/workflows directory."
        exit 1
    }
}

$MaxGate = 4

$GateResults = [ordered]@{
    "gate0_workflow_contract" = "not-applicable"
    "gate1_action_pins"       = "not-applicable"
    "gate1_agent_leaks"       = "not-applicable"
    "gate2_pwsh_ast"          = "not-applicable"
    "gate3_dist_drift"        = "not-applicable"
    "gate4_npm_test_and_pack" = "not-applicable"
}

function Write-GateSummary {
    Write-Host "`nGate Summary:" -ForegroundColor Cyan
    $activeFlags = @()
    if ($Quick) { $activeFlags += "-Quick" }
    if ($SkipGenerate) { $activeFlags += "-SkipGenerate" }
    if ($Gate0Only) { $activeFlags += "-Gate0Only" }
    if ($WorkflowsPath) { $activeFlags += "-WorkflowsPath" }
    if ($activeFlags.Count -gt 0) {
        Write-Host "  Flags: $($activeFlags -join ' ')"
    }
    foreach ($k in $GateResults.Keys) {
        $v = "$($GateResults[$k])".ToUpperInvariant()
        Write-Host "  [${k}: $v]"
    }
}

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
    $GateResults["gate0_workflow_contract"] = "fail"
    $GateResults["gate1_action_pins"] = "fail"

    $WorkflowCheckPath = Join-Path $RootDir "tools/check-workflows.mjs"
    $WorkflowArgs = @($WorkflowCheckPath)
    if ($WorkflowsPath) {
        $WorkflowArgs += @("--workflows-dir", $WorkflowsPath)
    }
    $WorkflowCheckOutput = & node @WorkflowArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        foreach ($err in $WorkflowCheckOutput) {
            Write-Fail $err
        }
        throw "Gate 0 Failed: Workflow drift detected. scripts/ci-local.ps1 must remain the sole source of CI test truth."
    }

    $GateResults["gate0_workflow_contract"] = "pass"
    $GateResults["gate1_action_pins"] = "pass"
    Exit-GatePass "All workflows delegate verification to scripts/ci-local.ps1 with zero drift." $StepTimer

    if ($Gate0Only) {
        Write-GateSummary
        Write-Host "`n====================================================" -ForegroundColor Green
        Write-Host " Gate 0 CI Verification Checks PASSED" -ForegroundColor Green
        Write-Host "====================================================" -ForegroundColor Cyan
        exit 0
    }

    # -------------------------------------------------------------
    # Gate 1: Agent & Scratch File Leak Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 1 $MaxGate "Auditing for agent & scratch file leaks"
    $GateResults["gate1_agent_leaks"] = "fail"

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

    $GateResults["gate1_agent_leaks"] = "pass"
    Exit-GatePass "No tracked or untracked agent files detected." $StepTimer

    # -------------------------------------------------------------
    # Gate 2: PowerShell AST Parse Validation
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 2 $MaxGate "Running PowerShell AST parse validation (*.ps1)"
    $GateResults["gate2_pwsh_ast"] = "fail"

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

    $GateResults["gate2_pwsh_ast"] = "pass"
    Exit-GatePass "PowerShell AST validation passed ($($Ps1Files.Count) script(s))." $StepTimer

    # -------------------------------------------------------------
    # Gate 3: Generated Distribution Drift Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Enter-Gate 3 $MaxGate "Verifying generated distribution outputs are up to date"

    if (-not $SkipGenerate -and -not $Quick) {
        $GateResults["gate3_dist_drift"] = "fail"
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

        $GateResults["gate3_dist_drift"] = "pass"
        Exit-GatePass "Generated outputs are up to date and clean." $StepTimer
    } else {
        $GateResults["gate3_dist_drift"] = "not-applicable"
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
    $GateResults["gate4_npm_test_and_pack"] = "fail"

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
        $GateResults["gate4_npm_test_and_pack"] = "pass"
    } else {
        $GateResults["gate4_npm_test_and_pack"] = "not-applicable"
        Write-Host "  -> Skipping npm pack --dry-run (-Quick)." -ForegroundColor Gray
    }

    Exit-GatePass "Composite test suite and packaging verification passed." $StepTimer

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    $TotalElapsed = [math]::Round($TotalTimer.Elapsed.TotalSeconds, 2)
    Write-GateSummary
    Write-Host "`n====================================================" -ForegroundColor Green
    Write-Host " All CI Verification Checks PASSED (${TotalElapsed}s)" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Cyan
} catch {
    if ($IsCI -and $script:InGroup) {
        Write-Host "::endgroup::"
        $script:InGroup = $false
    }
    Write-Fail $_.Exception.Message
    Write-GateSummary
    exit 1
} finally {
    Pop-Location
}
