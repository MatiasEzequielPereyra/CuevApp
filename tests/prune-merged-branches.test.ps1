#Requires -Version 5.1
# No GitHub calls: gh is a strict mock; git push can reach only a temporary bare repository.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sourceScript = Join-Path $root 'scripts/prune-merged-branches.ps1'
$realGit = (Get-Command git -CommandType Application | Select-Object -First 1).Source
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('cueva-prune-test-' + [guid]::NewGuid())
$bare = Join-Path $testRoot 'remote.git'
$repo = 'MatiasEzequielPereyra/CuevApp'
$url = "https://github.com/$repo.git"
$name = 'codex/cueva-005-notification-fixes'
$sourceSha = '7ade92558364a9fcd6d75c44c81d2446d5769355'
$fixtureRef = "refs/heads/$name"
$global:CuevaPruneTest = @{ Scenario = ''; Pushes = 0; ApiDeletes = 0 }

function Assert($condition, [string]$message) {
    if (-not $condition) { throw $message }
}
function gh {
    $global:LASTEXITCODE = 0
    $path = $args[1]
    if ($args -contains 'DELETE') { $global:CuevaPruneTest.apiDeletes++; throw 'REST deletion forbidden' }
    if ($args.Count -ne 2 -or $args[0] -ne 'api') { throw 'Unexpected gh command' }
    if ($path -eq "repos/$repo/git/ref/heads/main") {
        return (@{ object = @{ sha = $advanced } } | ConvertTo-Json -Depth 5)
    }
    if ($path -eq "repos/$repo/git/ref/heads/$name") {
        $value = if ($global:CuevaPruneTest.scenario -eq 'changed') { $advanced } else { $sha }
        return (@{ object = @{ sha = $value } } | ConvertTo-Json -Depth 5)
    }
    if ($path -eq "repos/$repo/pulls/65") {
        $headRepo = if ($global:CuevaPruneTest.scenario -eq 'fork') { 'someone/fork' } else { $repo }
        $state = if ($global:CuevaPruneTest.scenario -eq 'open') { 'open' } else { 'closed' }
        $headSha = if ($global:CuevaPruneTest.scenario -eq 'wrong-head') { $advanced } else { $sha }
        return (@{ merged_at = '2026-11-16'; state = $state
            head = @{ ref = $name; sha = $headSha; repo = @{ full_name = $headRepo } }
            base = @{ ref = 'main'; repo = @{ full_name = $repo } }
        } | ConvertTo-Json -Depth 5)
    }
    throw 'Other candidates intentionally unavailable in isolated test'
}
function git {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'config' -or $args[0] -eq 'remote') {
        if ($global:CuevaPruneTest.scenario -eq 'origin-fork') { return 'https://github.com/someone/fork.git' }
        $result = & $realGit -C $bare @args
        $global:LASTEXITCODE = $LASTEXITCODE
        return $result
    }
    Assert ($args -contains "--force-with-lease=${fixtureRef}:$sha") ("Missing exact expected-SHA lease: " + ($args -join " | ") + " expected=$fixtureRef/$sha scenario=$global:CuevaPruneTest.scenario")
    Assert ($args[-1] -ceq ":$fixtureRef") 'Wrong deletion refspec'
    Assert ($args[-2] -ceq $url) 'Unexpected remote destination'
    Assert ($args -contains '--no-verify') 'Local hooks must not run'
    Assert ($args -contains '--recurse-submodules=no') 'Submodule pushes must not run'
    $global:CuevaPruneTest.pushes++
    if ($global:CuevaPruneTest.scenario -eq 'race') {
        # Advance AFTER the script has checked the expected SHA, BEFORE receive-pack.
        & $realGit -C $bare update-ref $fixtureRef $advanced $sha
        Assert ($LASTEXITCODE -eq 0) 'Could not simulate concurrent push'
    }
    $localArgs = @($args)
    $localArgs[$localArgs.Count - 2] = $bare
    # Use the real transport and compare-and-delete implementation, fully offline.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $result = & $realGit @localArgs 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    $global:LASTEXITCODE = $code
    return $result
}

try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    & $realGit init --bare --quiet $bare
    Assert ($LASTEXITCODE -eq 0) 'Could not prepare local-only repository'
    $empty = Join-Path $testRoot 'empty-tree'
    [IO.File]::WriteAllBytes($empty, [byte[]]@())
    $tree = (& $realGit -C $bare hash-object -w -t tree $empty).Trim()
    Assert ($LASTEXITCODE -eq 0) 'Could not create synthetic tree'
    $identity = @('-c', 'user.name=CUEVA fixture', '-c', 'user.email=fixture@example.test')
    $sha = (& $realGit -C $bare @identity commit-tree $tree -m initial).Trim()
    Assert ($LASTEXITCODE -eq 0) 'Could not create synthetic initial commit'
    $advanced = (& $realGit -C $bare @identity commit-tree $tree -p $sha -m advanced).Trim()
    Assert ($LASTEXITCODE -eq 0) 'Could not create synthetic concurrent commit'
    & $realGit -C $bare remote add origin $url
    Assert ($LASTEXITCODE -eq 0) 'Could not set fixture origin'
    # Exercise the real script with only the allowlisted expected SHA replaced.
    # No objects from the project or branch being deleted are needed.
    $scriptPath = Join-Path $testRoot 'prune.ps1'
    $scriptText = [IO.File]::ReadAllText($sourceScript).Replace($sourceSha, $sha)
    [IO.File]::WriteAllText($scriptPath, $scriptText, (New-Object Text.UTF8Encoding($true)))
    foreach ($case in @('dry-run', 'changed', 'fork', 'open', 'wrong-head', 'origin-fork', 'push-rewrite', 'pushurl-fork', 'race', 'accepted', 'replay')) {
        $global:CuevaPruneTest.scenario = $case
        $global:CuevaPruneTest.pushes = 0
        if ($case -ne 'replay') {
            & $realGit -C $bare update-ref $fixtureRef $sha
            Assert ($LASTEXITCODE -eq 0) 'Could not reset synthetic candidate'
        }
        if ($case -eq 'push-rewrite') {
            & $realGit -C $bare config "url.https://example.test/fork.git.pushInsteadOf" $url
        }
        if ($case -eq 'pushurl-fork') {
            & $realGit -C $bare config remote.origin.pushurl 'https://example.test/fork.git'
        }
        $failed = $false
        try {
            & $scriptPath -Apply:($case -ne 'dry-run') *> $null
        } catch {
            $failed = $true
            if ($case -notin @('origin-fork', 'push-rewrite', 'pushurl-fork')) { throw }
        }
        if ($case -eq 'push-rewrite') { & $realGit -C $bare config --unset-all "url.https://example.test/fork.git.pushInsteadOf" }
        if ($case -eq 'pushurl-fork') { & $realGit -C $bare config --unset-all remote.origin.pushurl }
        $current = & $realGit -C $bare rev-parse --verify --quiet $fixtureRef
        if ($case -in @('origin-fork', 'push-rewrite', 'pushurl-fork')) { Assert $failed 'Wrong destination must fail closed' }
        if ($case -eq 'race') {
            Assert ($global:CuevaPruneTest.pushes -eq 1) 'Race must reach the atomic lease check'
            Assert ($current -eq $advanced) 'Concurrent push was deleted!'
        } elseif ($case -in @('accepted', 'replay')) {
            Assert (-not $current) 'Expected lease-protected deletion in local fixture only'
            Assert ($global:CuevaPruneTest.pushes -eq 1) 'Unexpected number of pushes'
        } else {
            Assert ($global:CuevaPruneTest.pushes -eq 0) "Unexpected push in $case"
            Assert ($current -eq $sha) "Ref modified in $case"
        }
        Assert ($global:CuevaPruneTest.apiDeletes -eq 0) 'REST DELETE must never be called'
        Write-Host "PASS $case"
    }
} finally {
    # Delete only the absolute temporary directory allocated by this test.
    $full = [IO.Path]::GetFullPath($testRoot)
    $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if (-not $full.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase) -or
        (Split-Path -Leaf $full) -notlike 'cueva-prune-test-*') { throw 'Unsafe cleanup target' }
    Remove-Variable CuevaPruneTest -Scope Global
    if (Test-Path -LiteralPath $full) { Remove-Item -LiteralPath $full -Recurse -Force }
}
