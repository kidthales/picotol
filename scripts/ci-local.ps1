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

    foreach ($wf in $WorkflowFiles) {
        $lines = Get-Content -Path $wf.FullName
        $inRunBlock = $false
        $runBaseIndent = 0
        $inRootPermissions = $false

        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            $lineNum = $i + 1

            if ($inRunBlock) {
                if ($line -match '^\s*$') {
                    continue
                }
                $line -match '^(?<sp>\s*)' | Out-Null
                $currentIndent = $Matches['sp'].Length
                if ($currentIndent -le $runBaseIndent) {
                    $inRunBlock = $false
                } else {
                    if ($line -match '\$\{\{') {
                        $DriftErrors.Add("$($wf.Name):$lineNum contains unescaped `${{ ... }} expression inside 'run:' script block (potential script injection). Pass values via 'env:' instead.")
                    }
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

            if ($line -match '^\s*(?:-\s*)?uses\s*:\s*(?<action>[^\s#]+)') {
                $actionRef = $Matches['action'].Trim()
                if ($actionRef -notmatch '^\./') {
                    if ($actionRef -match '@(?<ref>.*)$') {
                        $ref = $Matches['ref']
                        if ($ref -notmatch '^[a-fA-F0-9]{40}$') {
                            $DriftErrors.Add("$($wf.Name):$lineNum third-party action '$actionRef' is not pinned to a 40-character commit SHA.")
                        }
                    } else {
                        $DriftErrors.Add("$($wf.Name):$lineNum third-party action '$actionRef' is missing a commit SHA pin.")
                    }
                }
            }

            if ($line -match '^(?:permissions|\x22permissions\x22|\x27permissions\x27):\s*(?<permVal>.*)$') {
                $permVal = ($Matches['permVal'] -replace '#.*$', '').Trim()
                if ($permVal -eq '') {
                    $inRootPermissions = $true
                } else {
                    $inRootPermissions = $false
                    if ($permVal -match '\bwrite-all\b|:\s*write\b') {
                        $DriftErrors.Add("$($wf.Name):$lineNum grants root-level write permission '$($line.Trim())'. All workflows must default to least-privilege read permissions at root.")
                    }
                }
            } elseif ($line -match '^[a-zA-Z0-9_\x27\x22-]+:\s*') {
                $inRootPermissions = $false
            }
            if ($inRootPermissions -and $line -match '^\s*[a-zA-Z0-9_-]+\s*:\s*write\b') {
                $DriftErrors.Add("$($wf.Name):$lineNum grants root-level write permission '$($line.Trim())'. All workflows must default to least-privilege read permissions at root.")
            }

            if ($line -match '^(?<indent>\s*)(?:-\s*)?run\s*:\s*(?<val>.*)$') {
                $runBaseIndent = $Matches['indent'].Length
                $val = $Matches['val'].Trim()
                if ($val -match '^[|>][-+]?\s*(#.*)?$') {
                    $inRunBlock = $true
                } elseif ($val -ne '' -and $val -notmatch '^#') {
                    if ($val -match '\$\{\{') {
                        $DriftErrors.Add("$($wf.Name):$lineNum contains unescaped `${{ ... }} expression inside 'run:' script block (potential script injection). Pass values via 'env:' instead.")
                    }
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

    function Get-WorkflowJobs([string]$YamlContent) {
        $norm = $YamlContent -replace "\r\n", "`n"
        $parts = $norm -split '(?m)^jobs:\s*$'
        $jobMap = @{}
        if ($parts.Count -lt 2) {
            return $jobMap
        }
        $jobsSection = $parts[1]
        $jobMatches = [regex]::Matches($jobsSection, '(?m)^ {2}(?<name>[a-zA-Z0-9_-]+):\s*$')
        for ($i = 0; $i -lt $jobMatches.Count; $i++) {
            $name = $jobMatches[$i].Groups['name'].Value
            $start = $jobMatches[$i].Index
            $end = if ($i + 1 -lt $jobMatches.Count) { $jobMatches[$i + 1].Index } else { $jobsSection.Length }
            $jobMap[$name] = $jobsSection.Substring($start, $end - $start)
        }
        return $jobMap
    }

    # Structural verification for workflow contracts and least-privilege security
    $ReleaseWf = Join-Path $WorkflowDir "release.yml"
    if (Test-Path $ReleaseWf) {
        $releaseContent = (Get-Content -Path $ReleaseWf -Raw) -replace "\r\n", "`n"
        $releaseJobs = Get-WorkflowJobs $releaseContent
        if (-not $releaseJobs.ContainsKey('verify') -or $releaseJobs['verify'] -notmatch '(?m)^ {4}uses:\s*\./\.github/workflows/ci\.yml\s*$') {
            $DriftErrors.Add("release.yml verify job must delegate verification via 'uses: ./.github/workflows/ci.yml'.")
        }
        if (-not $releaseJobs.ContainsKey('verify') -or $releaseJobs['verify'] -notmatch '(?m)^ {4}permissions:\s*\n {6}contents:\s*read\s*\n {6}security-events:\s*write\s*$') {
            $DriftErrors.Add("release.yml verify job must explicitly scope permissions (contents: read, security-events: write).")
        }
        if ($releaseJobs.ContainsKey('verify') -and $releaseJobs['verify'] -match '(?m)^ {6}(?!security-events:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
            $DriftErrors.Add("release.yml verify job must not grant unauthorized write permissions.")
        }
        if (-not $releaseJobs.ContainsKey('tag-guard')) {
            $DriftErrors.Add("release.yml must define a 'tag-guard' job.")
        } else {
            $tgSlice = $releaseJobs['tag-guard']
            if ($tgSlice -notmatch '(?m)^ {4}permissions:\s*\n {6}contents:\s*read\s*$' -or $tgSlice -match '\b[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
                $DriftErrors.Add("release.yml tag-guard job must explicitly define 'permissions: contents: read' and no write permissions.")
            }
            if ($tgSlice -notmatch 'EXPECTED_TAG="v\$\{PKG_VER\}"') {
                $DriftErrors.Add("release.yml tag-guard must construct expected tag as EXPECTED_TAG=""v`${PKG_VER}"".")
            }
            if ($tgSlice -notmatch 'TAG="\$\{RELEASE_TAG:-\$REF_NAME\}"') {
                $DriftErrors.Add("release.yml tag-guard must fallback from RELEASE_TAG to REF_NAME.")
            }
            if ($tgSlice -notmatch 'if\s*\[\s*-z\s*"\$TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b') {
                $DriftErrors.Add("release.yml tag-guard must fail closed (exit 1) inside the missing-tag branch.")
            }
            if ($tgSlice -notmatch 'if\s*\[\s*"\$TAG"\s*!=\s*"\$EXPECTED_TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b') {
                $DriftErrors.Add("release.yml tag-guard must fail closed (exit 1) inside the tag-mismatch branch.")
            }
        }
        if (-not $releaseJobs.ContainsKey('verify') -or $releaseJobs['verify'] -notmatch '(?m)^ {4}needs:\s*\[tag-guard\]\s*$') {
            $DriftErrors.Add("release.yml verify job must depend on tag-guard (needs: [tag-guard]).")
        }
        foreach ($pubJob in @('publish-npm', 'publish-gpr', 'attach-assets')) {
            if (-not $releaseJobs.ContainsKey($pubJob) -or $releaseJobs[$pubJob] -notmatch '(?m)^ {4}needs:\s*\[verify\]\s*$') {
                $DriftErrors.Add("release.yml $pubJob job must depend on verify (needs: [verify]).")
            }
            if ($releaseJobs.ContainsKey($pubJob) -and $releaseJobs[$pubJob] -match 'cache:\s*["\x27]?npm["\x27]?') {
                $DriftErrors.Add("release.yml $pubJob job must not use shared npm cache.")
            }
        }
        if ($releaseJobs.ContainsKey('notify') -and $releaseJobs['notify'] -match '\b[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
            $DriftErrors.Add("release.yml notify job must not grant write permissions.")
        }
        if ($releaseJobs.ContainsKey('notify') -and $releaseJobs['notify'] -notmatch 'ASSETS_STATUS:\s*\$\{\{\s*needs\.attach-assets\.result\s*\|\|\s*\x27skipped\x27\s*\}\}') {
            $DriftErrors.Add("release.yml notify job must report skipped status when attach-assets is skipped.")
        }
    }

    $PagesWf = Join-Path $WorkflowDir "pages.yml"
    if (Test-Path $PagesWf) {
        $pagesContent = (Get-Content -Path $PagesWf -Raw) -replace "\r\n", "`n"
        $pagesJobs = Get-WorkflowJobs $pagesContent
        if (-not $pagesJobs.ContainsKey('verify') -or $pagesJobs['verify'] -notmatch '(?m)^ {4}uses:\s*\./\.github/workflows/ci\.yml\s*$') {
            $DriftErrors.Add("pages.yml verify job must delegate verification via 'uses: ./.github/workflows/ci.yml'.")
        }
        if (-not $pagesJobs.ContainsKey('verify') -or $pagesJobs['verify'] -notmatch '(?m)^ {4}permissions:\s*\n {6}contents:\s*read\s*\n {6}security-events:\s*write\s*$') {
            $DriftErrors.Add("pages.yml verify job must explicitly scope permissions (contents: read, security-events: write).")
        }
        if (-not $pagesJobs.ContainsKey('build') -or $pagesJobs['build'] -notmatch '(?m)^ {4}needs:\s*\[verify\]\s*$') {
            $DriftErrors.Add("pages.yml build job must depend on verify (needs: [verify]).")
        }
        if (-not $pagesJobs.ContainsKey('deploy') -or $pagesJobs['deploy'] -notmatch '(?m)^ {4}needs:\s*\[build\]\s*$') {
            $DriftErrors.Add("pages.yml deploy job must depend on build (needs: [build]).")
        }
        if (-not $pagesJobs.ContainsKey('deploy') -or $pagesJobs['deploy'] -notmatch '(?m)^ {4}permissions:\s*\n {6}pages:\s*write\s*\n {6}id-token:\s*write\s*$') {
            $DriftErrors.Add("pages.yml deploy job must explicitly scope permissions (pages: write, id-token: write).")
        }
        foreach ($jobKey in $pagesJobs.Keys) {
            if ($jobKey -notin @('deploy', 'verify') -and $pagesJobs[$jobKey] -match '\b[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
                $DriftErrors.Add("pages.yml job '$jobKey' must not grant any write permissions.")
            }
        }
        if ($pagesJobs.ContainsKey('verify') -and $pagesJobs['verify'] -match '(?m)^ {6}(?!security-events:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
            $DriftErrors.Add("pages.yml verify job must not grant unauthorized write permissions.")
        }
    }

    $CiWf = Join-Path $WorkflowDir "ci.yml"
    if (Test-Path $CiWf) {
        $ciContent = (Get-Content -Path $CiWf -Raw) -replace "\r\n", "`n"
        if ($ciContent -notmatch '(?m)^name:\s*CI\s*$') {
            $DriftErrors.Add("ci.yml workflow name must be 'CI' to match cancel-in-progress concurrency expression.")
        }
        if ($ciContent -notmatch '(?m)^\s*workflow_call:\s*$') {
            $DriftErrors.Add("ci.yml must support reusable workflow calls via 'workflow_call:'.")
        }
        if ($ciContent -notmatch '(?m)^concurrency:\s*\n {2}group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}\s*\n {2}cancel-in-progress:\s*\$\{\{\s*github\.workflow\s*==\s*\x27CI\x27\s*\}\}') {
            $DriftErrors.Add("ci.yml concurrency block must isolate callers via github.workflow and scope cancel-in-progress to github.workflow == 'CI'.")
        }
        $ciJobs = Get-WorkflowJobs $ciContent
        if (-not $ciJobs.ContainsKey('security')) {
            $DriftErrors.Add("ci.yml must define a dedicated 'security' job to run gitleaks and zizmor once rather than per matrix leg.")
        } else {
            if ($ciJobs['security'] -notmatch '(?m)^ {4}permissions:\s*\n {6}contents:\s*read\s*\n {6}security-events:\s*write\s*$') {
                $DriftErrors.Add("ci.yml security job must explicitly scope permissions (contents: read, security-events: write).")
            }
            if ($ciJobs['security'] -notmatch 'gitleaks/gitleaks-action') {
                $DriftErrors.Add("ci.yml security job must run gitleaks secret detection.")
            }
            if ($ciJobs['security'] -notmatch 'zizmorcore/zizmor-action') {
                $DriftErrors.Add("ci.yml security job must run zizmor workflow analysis.")
            }
        }
        foreach ($jobKey in $ciJobs.Keys) {
            if ($jobKey -ne 'security' -and $ciJobs[$jobKey] -match '\b[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
                $DriftErrors.Add("ci.yml job '$jobKey' must not grant any write permissions.")
            }
        }
        if ($ciJobs.ContainsKey('security') -and $ciJobs['security'] -match '(?m)^ {6}(?!security-events:\s*write\b)[a-z-]+\s*:\s*write\b|\bwrite-all\b') {
            $DriftErrors.Add("ci.yml security job must not grant unauthorized write permissions.")
        }
        if ($ciJobs.ContainsKey('verify') -and $ciJobs['verify'] -match 'gitleaks/gitleaks-action') {
            $DriftErrors.Add("ci.yml verify matrix job must not run gitleaks (must run once in security job).")
        }
        if ($ciJobs.ContainsKey('notify') -and $ciJobs['notify'] -notmatch 'if:\s*always\(\)\s*&&\s*github\.event_name\s*!=\s*\x27workflow_call\x27\s*&&\s*github\.workflow\s*==\s*\x27CI\x27') {
            $DriftErrors.Add("ci.yml notify job must skip execution under workflow_call via 'if: always() && github.event_name != ''workflow_call'' && github.workflow == ''CI'''.")
        }
    }

    # Verify all actions/checkout steps enforce persist-credentials: false
    $expectedCheckoutCounts = @{
        'ci.yml'      = 2
        'release.yml' = 4
        'pages.yml'   = 1
    }
    foreach ($wf in $WorkflowFiles) {
        $rawWf = (Get-Content -Path $wf.FullName -Raw) -replace "\r\n", "`n"
        $checkoutMatches = [regex]::Matches($rawWf, '(?m)^\s*(?:-\s*)?uses:\s*actions/checkout@[^\n]+\n(?<step>(?: {8,}[^\n]+\n)*)')
        if ($expectedCheckoutCounts.ContainsKey($wf.Name)) {
            $expectedCount = $expectedCheckoutCounts[$wf.Name]
            if ($checkoutMatches.Count -ne $expectedCount) {
                $DriftErrors.Add("$($wf.Name) has $($checkoutMatches.Count) actions/checkout step(s), expected $expectedCount.")
            }
        } elseif ($checkoutMatches.Count -eq 0) {
            $DriftErrors.Add("$($wf.Name) has zero actions/checkout steps matched; expected at least one.")
        }
        foreach ($m in $checkoutMatches) {
            $stepText = $m.Groups['step'].Value
            if ($stepText -notmatch 'persist-credentials:\s*false') {
                $DriftErrors.Add("$($wf.Name) contains actions/checkout step missing 'persist-credentials: false'.")
            }
        }
    }

    if ($DriftErrors.Count -gt 0) {
        foreach ($err in $DriftErrors) {
            Write-Fail $err
        }
        throw "Gate 0 Failed: Workflow drift detected ($($DriftErrors.Count) violation(s)). scripts/ci-local.ps1 must remain the sole source of CI test truth."
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
