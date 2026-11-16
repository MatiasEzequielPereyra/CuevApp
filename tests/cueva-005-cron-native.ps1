# From the repository root. Uses two disposable containers and no host ports.
$ErrorActionPreference = 'Stop'
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
$database = "cueva-005-cron-db-$suffix"
$sink = "cueva-005-cron-http-$suffix"
$dbImage = 'public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9'
$sinkImage = 'docker.io/library/python@sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e'
$loopbackUrl = 'http://127.0.0.1:18765/api/notifications/worker'
$originalControl = Get-Content -Raw docs/operations/CUEVA-005-cron-control.sql
$control = $originalControl.Replace('https://cueva-gym.vercel.app/api/notifications/worker', $loopbackUrl)
if ($control -eq $originalControl -or $control.Contains('vercel.app')) { throw 'Expected one isolated destination' }
$queue = Get-Content -Raw docs/operations/CUEVA-005-queue-preflight.sql
$dbStarted = $false
$sinkStarted = $false

function Invoke-LabSql {
    param([string]$Sql, [string[]]$Variables = @(), [string]$ExpectedError)
    $result = $Sql | docker exec -i $database psql -X -qAt -v ON_ERROR_STOP=on -U postgres -d postgres @Variables 2>&1
    $exitCode = $LASTEXITCODE
    $lines = @($result | ForEach-Object { $_.ToString() })
    if ($ExpectedError) {
        if ($exitCode -eq 0 -or ($lines -join "`n") -notmatch $ExpectedError) {
            throw "Expected denial [$ExpectedError]. Got [$($lines -join ' ')]"
        }
        Write-Host "PASS denial: $ExpectedError"
        return
    }
    if ($exitCode -ne 0) { throw ($lines -join "`n") }
    $lines
}

function Assert-LabSql([string]$Sql, [string]$Expected) {
    $actual = (Invoke-LabSql $Sql) -join "`n"
    if ($actual -cne $Expected) { throw "Expected [$Expected], got [$actual] for [$Sql]" }
}

function Invoke-CronControl([string]$Operation, [string]$JobId, [string]$ExpectedError) {
    Invoke-LabSql "set role cueva_fixture_cron;`n$control" @(
        '-v', "cueva_operation=$Operation", '-v', "cueva_job_id=$JobId"
    ) $ExpectedError
}

function Wait-ForSuccessfulRuns([int]$Count) {
    $deadline = (Get-Date).AddSeconds(330)
    do {
        $runs = Invoke-LabSql "select count(*) from cron.job_run_details where jobid=$jobId and status='succeeded';"
        $responses = Invoke-LabSql 'select count(*) from net._http_response where status_code=204;'
        if ($runs -eq "$Count" -and $responses -eq "$Count") { return }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw "Expected $Count successful cron jobs and HTTP 204 responses. Got $runs and $responses"
}

try {
    docker run --pull never --rm -d --name $database --network none --cpus 2 --memory 768m `
        --tmpfs /lab-data --entrypoint /bin/sh $dbImage -ec '
        chown postgres:postgres /lab-data
        gosu postgres initdb -D /lab-data/pg --auth=trust >/dev/null
        exec gosu postgres postgres -D /lab-data/pg -c shared_preload_libraries=pg_cron,pg_net,supabase_vault -c cron.use_background_workers=on -c cron.timezone=UTC -c cron.database_name=postgres -c pg_net.database_name=postgres -c vault.getkey_script=/usr/lib/postgresql/bin/pgsodium_getkey.sh
    ' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start isolated PostgreSQL' }
    $dbStarted = $true

    $receiver = @'
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        valid = (self.path == '/api/notifications/worker'
                 and self.headers.get('Authorization') == 'Bearer ' + 'x' * 48
                 and self.headers.get('Content-Type') == 'application/json'
                 and self.rfile.read(int(self.headers.get('Content-Length', 0))) == b'{}')
        self.send_response(204 if valid else 400)
        self.end_headers()

HTTPServer(('127.0.0.1', 18765), Handler).serve_forever()
'@
    docker run --pull never --rm -d --name $sink --network "container:$database" --cpus 0.5 --memory 96m `
        $sinkImage python -u -c $receiver | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start loopback receiver' }
    $sinkStarted = $true

    $deadline = (Get-Date).AddSeconds(35)
    do {
        docker exec $database pg_isready -U postgres -d postgres | Out-Null
        if ($LASTEXITCODE -eq 0) { break }
        if ((Get-Date) -ge $deadline) { throw 'PostgreSQL readiness timeout' }
        Start-Sleep -Seconds 1
    } while ($true)

    Invoke-LabSql @'
create role anon;
create role authenticated;
create role cueva_fixture_cron login;
create role cueva_fixture_inherited;
create extension pg_cron;
create extension pg_net;
create extension supabase_vault;
grant usage on schema cron to cueva_fixture_cron;
grant execute on function cron.alter_job(bigint,text,text,text,text,boolean) to cueva_fixture_cron;
grant usage on schema vault to cueva_fixture_cron;
grant select on vault.decrypted_secrets to cueva_fixture_cron;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to cueva_fixture_cron;
grant select (headers) on net.http_request_queue to authenticated;
grant update (url) on net.http_request_queue to cueva_fixture_inherited;
grant cueva_fixture_inherited to anon;
select version();
select extname, extversion from pg_extension
where extname in ('pg_cron', 'pg_net', 'supabase_vault') order by extname;
'@

    $checkMode = @('-v', 'cueva_queue_mode=check', '-v', 'cueva_cron_role=cueva_fixture_cron')
    $restrictMode = @('-v', 'cueva_queue_mode=restrict', '-v', 'cueva_cron_role=cueva_fixture_cron')
    Invoke-LabSql $queue $checkMode 'queue accessible to API roles'
    Invoke-LabSql $queue $restrictMode 'queue accessible to API roles'
    Assert-LabSql "select has_table_privilege('anon','net.http_request_queue','SELECT');" 't'
    Invoke-LabSql 'revoke cueva_fixture_inherited from anon;'
    Invoke-LabSql $queue $restrictMode
    Invoke-LabSql $queue $checkMode
    Invoke-LabSql 'set role authenticated; select headers from net.http_request_queue;' -ExpectedError 'permission denied'
    Invoke-LabSql "set role anon; update net.http_request_queue set url='http://127.0.0.1:1';" -ExpectedError 'permission denied'
    Assert-LabSql "select has_table_privilege('anon','net._http_response','SELECT'), count(*) from net.http_request_queue;" 't|0'
    Write-Host 'PASS queue-only restriction before Vault, native cron role enqueue probe rolled back'

    $foreignJob = Invoke-LabSql "set role cueva_fixture_cron; select cron.schedule('cueva-fixture-other','0 0 1 1 *','select 1');"
    $null = Invoke-LabSql "select vault.create_secret('$loopbackUrl','cueva_notifications_worker_url'); select vault.create_secret(repeat('x',48),'cueva_notifications_worker_secret');"
    $activation = Invoke-CronControl 'activate' '0'
    Write-Host "ACTIVATE $activation"
    $jobId = ($activation -split '\|')[0]
    if ($jobId -notmatch '^[1-9][0-9]*$') { throw 'Activation did not return a job ID' }
    Assert-LabSql "select schedule, active from cron.job where jobid=$jobId;" '*/5 * * * *|t'
    Invoke-CronControl 'activate' '0' 'already exists or overlaps'
    Invoke-CronControl 'resume' $jobId 'cannot resume.*while active'
    Wait-ForSuccessfulRuns 1
    Write-Host 'PASS first real cron run returned HTTP 204 from isolated receiver'

    $stop = Invoke-CronControl 'stop' $jobId
    Write-Host "STOP $stop"
    Assert-LabSql "select active from cron.job where jobid=$jobId;" 'f'
    Invoke-CronControl 'resume' $foreignJob 'job identity mismatch'
    Invoke-LabSql "create table cueva_fixture_command as select command from cron.job where jobid=$jobId;"
    $null = Invoke-LabSql "select cron.alter_job($jobId, schedule := '* * * * *');"
    Invoke-CronControl 'resume' $jobId 'changed metadata'
    $null = Invoke-LabSql "select cron.alter_job($jobId, schedule := '*/5 * * * *', command := 'select 1');"
    Invoke-CronControl 'resume' $jobId 'changed metadata'
    $null = Invoke-LabSql "select cron.alter_job($jobId, command := (select command from cueva_fixture_command));"
    $null = Invoke-LabSql "select vault.update_secret(id, 'http://127.0.0.1:1/wrong') from vault.secrets where name='cueva_notifications_worker_url';"
    Invoke-CronControl 'resume' $jobId 'Vault configuration invalid'
    $null = Invoke-LabSql "select vault.update_secret(id, '$loopbackUrl') from vault.secrets where name='cueva_notifications_worker_url';"
    Invoke-LabSql 'grant select (headers) on net.http_request_queue to anon;'
    Invoke-CronControl 'resume' $jobId 'credentials or queue accessible to API roles'
    Invoke-LabSql 'revoke select (headers) on net.http_request_queue from anon; revoke insert (url) on net.http_request_queue from cueva_fixture_cron;'
    Invoke-CronControl 'resume' $jobId 'permission denied'
    Invoke-LabSql 'grant insert (url) on net.http_request_queue to cueva_fixture_cron;'
    Assert-LabSql "select active from cron.job where jobid=$jobId;" 'f'
    $firstRun = Invoke-LabSql "select runid from cron.job_run_details where jobid=$jobId and status='succeeded';"

    $resume = Invoke-CronControl 'resume' $jobId
    Write-Host "RESUME $resume"
    Wait-ForSuccessfulRuns 2
    Assert-LabSql "select exists (select 1 from cron.job_run_details where jobid=$jobId and runid=$firstRun and status='succeeded'), (select active from cron.job where jobid=$foreignJob), (select count(*) from net._http_response);" 't|t|2'
    Write-Host 'PASS second native POST, same job and earlier run history preserved, unrelated job untouched'
    $null = Invoke-CronControl 'stop' $jobId
} finally {
    if ($sinkStarted) { docker rm -f $sink | Out-Null }
    if ($dbStarted) { docker rm -f $database | Out-Null }
}
