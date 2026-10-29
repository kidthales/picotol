<#
.SYNOPSIS
    Runs local continuous integration suite for @kidthales/picotol.
.DESCRIPTION
    Executes the full test and verification pipeline locally with 1:1 remote CI parity:
    1. Agent & scratch file leak audit (tracked & untracked)
    2. PowerShell AST parse validation & CSS AST linter (npm run lint)
    3. Test suite & packaging dry-run (npm test, npm pack --dry-run)
    4. Generated distribution drift audit (npm run generate -> git status dist)
    5. Bundle size & compression budget audit (npm run check:budgets)
.PARAMETER Quick
    Runs lint and tests only; skips distribution regeneration and packaging dry-run.
.PARAMETER SkipGenerate
    Skips the distribution regeneration and drift verification step.
.EXAMPLE
    pwsh ./scripts/ci-local.ps1
    pwsh ./scripts/ci-local.ps1 -Quick
#>
[CmdletBinding()]
param(
    [switch]$Quick,
    [switch]$SkipGenerate
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

$TotalTimer = [System.Diagnostics.Stopwatch]::StartNew()

function Write-StepHeader([int]$Step, [int]$TotalSteps, [string]$Title) {
    Write-Host "`n[$Step/$TotalSteps] $Title..." -ForegroundColor Yellow
}

function Write-Pass([string]$Message, [System.Diagnostics.Stopwatch]$Timer) {
    $elapsed = [math]::Round($Timer.Elapsed.TotalSeconds, 2)
    Write-Host "  -> [OK] $Message (${elapsed}s)" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
    Write-Host "  -> [FAIL] $Message" -ForegroundColor Red
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " picotol Local CI Pipeline" -ForegroundColor Cyan
Write-Host " Root: $RootDir" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Cyan

$TotalSteps = 5

Push-Location $RootDir
try {
    # -------------------------------------------------------------
    # Gate 1: Agent & Scratch File Leak Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-StepHeader 1 $TotalSteps "Auditing for agent & scratch file leaks"

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

    Write-Pass "No tracked or untracked agent files detected." $StepTimer

    # -------------------------------------------------------------
    # Gate 2: PowerShell AST Parse & Linter Validation
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-StepHeader 2 $TotalSteps "Running PowerShell AST validation and CSS AST linter (npm run lint)"

    # PowerShell AST parse validation for scripts
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

    Write-Host "  -> Running npm run lint..." -ForegroundColor DarkGray
    & npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm run lint failed with exit code $LASTEXITCODE."
        throw "Gate 2 Failed: Linter errors detected."
    }

    Write-Pass "PowerShell AST and CSS AST linter validations passed." $StepTimer

    # -------------------------------------------------------------
    # Gate 3: Test Suite & Packaging Verification
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-StepHeader 3 $TotalSteps "Running test suite and packaging verification (npm test, npm pack --dry-run)"

    Write-Host "  -> Running npm test..." -ForegroundColor DarkGray
    & npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm test failed with exit code $LASTEXITCODE."
        throw "Gate 3 Failed: Unit tests failed."
    }

    if (-not $Quick) {
        Write-Host "  -> Running npm pack --dry-run..." -ForegroundColor DarkGray
        & npm pack --dry-run
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm pack --dry-run failed with exit code $LASTEXITCODE."
            throw "Gate 3 Failed: Package packaging dry-run failed."
        }
    } else {
        Write-Host "  -> Skipping npm pack --dry-run (-Quick)." -ForegroundColor Gray
    }

    Write-Pass "Test suite and packaging verification passed." $StepTimer

    # -------------------------------------------------------------
    # Gate 4: Generated Distribution Drift Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-StepHeader 4 $TotalSteps "Verifying generated distribution outputs are up to date"

    if (-not $SkipGenerate -and -not $Quick) {
        Write-Host "  -> Running npm run generate..." -ForegroundColor DarkGray
        & npm run generate
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm run generate failed with exit code $LASTEXITCODE."
            throw "Gate 4 Failed: Distribution generation failed."
        }

        $DistStatus = & git status --porcelain dist
        if ($DistStatus) {
            Write-Fail "dist/ differs from a fresh generation. Run 'npm run generate' and commit the result."
            Write-Host "Drift details:" -ForegroundColor Red
            & git status --porcelain dist
            & git diff --stat dist
            throw "Gate 4 Failed: Generated distribution drift detected."
        }

        Write-Pass "Generated outputs are up to date and clean." $StepTimer
    } else {
        Write-Host "  -> Skipping distribution regeneration (-SkipGenerate or -Quick)." -ForegroundColor Gray
    }

    # -------------------------------------------------------------
    # Gate 5: Bundle Size & Compression Budget Audit
    # -------------------------------------------------------------
    $StepTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-StepHeader 5 $TotalSteps "Auditing bundle size & compression budgets (npm run check:budgets)"

    Write-Host "  -> Running npm run check:budgets..." -ForegroundColor DarkGray
    & npm run check:budgets
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm run check:budgets failed with exit code $LASTEXITCODE."
        throw "Gate 5 Failed: Bundle size or compression budget violation detected."
    }

    Write-Pass "Bundle size, compression budgets, and README sync verified." $StepTimer

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    $TotalElapsed = [math]::Round($TotalTimer.Elapsed.TotalSeconds, 2)
    Write-Host "`n====================================================" -ForegroundColor Green
    Write-Host " All Local CI Verification Checks PASSED (${TotalElapsed}s)" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Cyan
} finally {
    Pop-Location
}
