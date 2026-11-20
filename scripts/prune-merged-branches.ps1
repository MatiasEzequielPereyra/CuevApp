#Requires -Version 5.1
<#
.SYNOPSIS
  Muestra o borra solo las ramas CUEVA documentadas como HEAD exactos de PRs fusionados.
.DESCRIPTION
  Por defecto no borra nada. Revalida el SHA remoto y el PR MERGED inmediatamente
  antes de cada eliminación. Omite ramas cambiadas, protegidas o ya inexistentes.
  GitHub CLI (gh) debe estar autenticado con acceso al repositorio.
  Origen: docs/engineering/REPO-STATUS-2026-11-19.md.
.EXAMPLE
  .\scripts\prune-merged-branches.ps1
.EXAMPLE
  .\scripts\prune-merged-branches.ps1 -Apply
#>
[CmdletBinding()]
param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$Repository = 'MatiasEzequielPereyra/CuevApp'

$Candidates = @(
    @{ Name = 'codex/cueva-005-notification-fixes'; Sha = '7ade92558364a9fcd6d75c44c81d2446d5769355'; Pr = 65 }
    @{ Name = 'codex/cueva-005-rollout-audit'; Sha = '9d38f5ba7a2a03e7ae2d4a7492b357624df475c0'; Pr = 61 }
    @{ Name = 'codex/cueva-admin-account-menu'; Sha = '4e026793e23856d667f86092552ebc67d07415ce'; Pr = 49 }
    @{ Name = 'codex/cueva-audit-picomatch-exception'; Sha = '4ee06d5e948427c56ce9541a5a5e6d1ee6a1a533'; Pr = 70 }
    @{ Name = 'codex/cueva-ejercicios-ux'; Sha = 'b28baaa8cb81088a30027161779f6ee25a809849'; Pr = 48 }
    @{ Name = 'codex/cueva-pr58-checkpoint'; Sha = '7b5a6a1cb30e931e54073b2d408922d697fe6266'; Pr = 59 }
    @{ Name = 'codex/cueva-pwa-login'; Sha = '19f6545540f53919f3d639757152a0819651684c'; Pr = 57 }
    @{ Name = 'codex/cueva-test-fixture-isolation'; Sha = '2a08a8b6905987a3705ca221ce573c416871b78e'; Pr = 72 }
    @{ Name = 'codex/cueva-ux-alumnos'; Sha = '37601aa4aa1fd59a1b16eb3cb429a53d74cc26ab'; Pr = 52 }
    @{ Name = 'codex/cueva-ux-inicio'; Sha = '3a325794d7203321ec026a8da2aa94910d6e8f98'; Pr = 50 }
    @{ Name = 'codex/cueva-ux-mi-rutina'; Sha = '00977d70c57c23fea999fe87e4ec7cc7d880ef0b'; Pr = 55 }
    @{ Name = 'codex/cueva-ux-nav-movil'; Sha = 'b87af7eb26fdd49ef439665f20a8e7ae7639e583'; Pr = 51 }
    @{ Name = 'codex/cueva-ux-nuevo-bloque'; Sha = 'c0322e3c7c1c2dc82880a314b350c10b878cbd8c'; Pr = 58 }
    @{ Name = 'codex/cueva-ux-portal-alumno'; Sha = 'e38129d6479aa8becbcaddd4bf209a8773389ba1'; Pr = 69 }
    @{ Name = 'codex/cueva-ux-rutinas-editor'; Sha = '9baa9d5223fa82affd327b1329502fa360297c58'; Pr = 54 }
    @{ Name = 'codex/next-16-4-6'; Sha = '301de0dd0928ce7eb05e800e508380086d1c5063'; Pr = 66 }
    @{ Name = 'docs/reconcile-current-state-2026-11-16'; Sha = '1ece52752803e847f88b2d2cbe0f4cd97927b833'; Pr = 60 }
    @{ Name = 'feature/account-password-management'; Sha = '59ed005c690a9f0c8f3e04958edb15af39df1920'; Pr = 64 }
    @{ Name = 'feature/cueva-admin-account-student-access-ux'; Sha = 'baf7ae61956f971063422b8b97fcbbdd89e3aba1'; Pr = 73 }
    @{ Name = 'feature/cueva-exercise-prefix-search'; Sha = 'f6b3d89d0ffbc32b881b6afa6c40ab90c5f2c163'; Pr = 62 }
    @{ Name = 'feature/cueva-ux-comprobantes-actions'; Sha = '244f0e9e5b3ae25a5991cffdb35ed4cd093efe69'; Pr = 74 }
    @{ Name = 'feature/routine-text-mentions'; Sha = '65cfd36b3864d95c32fdcf9e36f19f58271fc4c2'; Pr = 67 }
    @{ Name = 'feature/student-portal-experience'; Sha = 'a44d5a7c2c1c4e3e5b87dae9665ead9c081bd9b8'; Pr = 53 }
    @{ Name = 'feature/student-portal-polish'; Sha = 'de2f3424b9b026d85e62da203bf75450b3a156fd'; Pr = 63 }
    @{ Name = 'fix/notification-inbox-hydration'; Sha = 'e0bdd681fb11e9f9d31785608bc113328d7b456d'; Pr = 68 }
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'Falta GitHub CLI (gh). Instalarlo y ejecutar gh auth login antes de usar este script.'
}

function Get-GitHubObject {
    param([Parameter(Mandatory = $true)][string]$ApiPath)
    $output = & gh api $ApiPath 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub API falló en '$ApiPath': $($output | Out-String)"
    }
    return ($output | Out-String | ConvertFrom-Json)
}

$null = Get-GitHubObject -ApiPath "repos/$Repository/git/ref/heads/main"
$ok = 0
$deleted = 0
$skipped = 0
Write-Host ("CUEVA: {0} candidatas verificadas desde el inventario. Apply={1}" -f $Candidates.Count, $Apply.IsPresent)

foreach ($candidate in $Candidates) {
    if ($candidate.Name -eq 'main') { throw 'Protección: main nunca puede borrarse.' }

    try {
        $ref = Get-GitHubObject -ApiPath "repos/$Repository/git/ref/heads/$($candidate.Name)"
        $pr = Get-GitHubObject -ApiPath "repos/$Repository/pulls/$($candidate.Pr)"
        if ($ref.object.sha -ne $candidate.Sha) {
            throw ("SHA cambió: esperado {0}, real {1}" -f $candidate.Sha, $ref.object.sha)
        }
        if ([string]::IsNullOrWhiteSpace([string]$pr.merged_at) -or $pr.state -ne 'closed') {
            throw ("PR #{0} ya no acredita MERGED" -f $candidate.Pr)
        }
        if ($pr.head.ref -ne $candidate.Name -or $pr.head.sha -ne $candidate.Sha) {
            throw ("El HEAD del PR #{0} no coincide con la rama remota" -f $candidate.Pr)
        }
        $ok += 1
    } catch {
        $skipped += 1
        Write-Warning ("OMITIDA {0}: {1}" -f $candidate.Name, $_.Exception.Message)
        continue
    }

    if (-not $Apply) {
        Write-Host ("DRY-RUN BORRABLE: {0} (PR #{1}, {2})" -f $candidate.Name, $candidate.Pr, $candidate.Sha.Substring(0, 12))
        continue
    }

    $deleteResult = & gh api --method DELETE "repos/$Repository/git/refs/heads/$($candidate.Name)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $skipped += 1
        Write-Warning ("NO BORRADA {0}: {1}" -f $candidate.Name, ($deleteResult | Out-String))
        continue
    }
    $deleted += 1
    Write-Host ("BORRADA: {0}" -f $candidate.Name)
}

Write-Host ("Resumen: verificadas={0}; borradas={1}; omitidas={2}; aplicar={3}" -f $ok, $deleted, $skipped, $Apply.IsPresent)
if (-not $Apply) {
    Write-Host 'Solo vista previa; ejecutar con -Apply para intentar borrar las candidatas verificadas.'
}
