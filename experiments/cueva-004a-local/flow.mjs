import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { forgedXrefFixture, validPdfFixture } from "../../tests/fixtures/receipt-pdf.mjs";

const bucket = "cueva-payment-receipts";

export async function runBrowserFlow({ base, rest, storageBase, admin, anon, password, sql, request, note, launch, chromium, dbPort, coordinatorPassword, secret }) {
  let app, browser, gateway;
  const check = (name, pass, detail = "") => {
    note(name, pass ? "PASS" : "FAIL", detail);
    if (!pass) throw new Error(name);
  };
  try {
    for (const file of ["20261107100000_cueva_membership_read.sql", "20261107100100_cueva_payment_receipts.sql"]) {
      sql(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    sql("notify pgrst, 'reload schema';");
    const users = [];
    for (const role of ["admin", "alumno", "alumno"]) {
      const email = `receipt-${users.length}@example.com`;
      const response = await request(`${base}/admin/users`, { method: "POST", token: admin, body: { email, password, email_confirm: true } });
      const { id } = await response.json();
      check(`synthetic_user_${users.length}`, response.ok && /^[a-f0-9-]{36}$/.test(id));
      sql(`insert into public.cueva_profiles values ('${id}', '${role}');
        insert into cueva_private.access_state(user_id,ready,session_not_before) values ('${id}',true,'2000-01-01');`);
      users.push({ email, id });
    }
    const actor = users[0].id, price = randomUUID();
    sql(`insert into public.cueva_prices(id,effective_month,cents,actor) values ('${price}','2000-01-01',10000,'${actor}');`);
    for (const user of users.slice(1)) {
      const student = randomUUID();
      user.periods = [randomUUID(), randomUUID(), randomUUID()];
      sql(`insert into public.cueva_students(id,first_name,last_name,email,joined_on,active)
          values ('${student}','Persona','Sintética','${user.email}','2000-01-01',true);
        insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by)
          values ('${student}','${user.email}','${user.id}','sent','${randomUUID()}','${actor}');`);
      for (const [offset, period] of user.periods.entries()) {
        const month = `(date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') - interval '${offset} months')::date`;
        sql(`insert into public.cueva_periods(id,student_id,month,due_on,cents,price_id,actor)
          values ('${period}','${student}',${month},${month}+10,10000,'${price}','${actor}');`);
      }
    }

    // Supabase Storage has its own local container. This loopback gateway
    // provides the same /storage/v1 prefix as the production API gateway.
    gateway = createServer(async (req, res) => {
      try {
        const headers = { ...req.headers };
        delete headers.host;
        const result = await fetch(`${storageBase}${req.url.replace(/^\/storage\/v1/, "")}`, {
          method: req.method, headers,
          ...(!["GET", "HEAD"].includes(req.method) ? { body: Readable.toWeb(req), duplex: "half" } : {}),
          redirect: "manual",
        });
        res.writeHead(result.status, Object.fromEntries(result.headers));
        if (result.body) Readable.fromWeb(result.body).pipe(res);
        else res.end();
      } catch {
        res.writeHead(502).end();
      }
    });
    await new Promise(resolve => gateway.listen(0, "127.0.0.1", resolve));
    const storageOrigin = `http://127.0.0.1:${gateway.address().port}`;
    process.env.CUEVA_LAB_STORAGE_ORIGIN = storageOrigin;
    process.env.CRON_SECRET = secret();

    app = await launch({ authBase: base, restBase: rest, anonKey: anon, admin, dbPort, dbPassword: coordinatorPassword });
    browser = await chromium.launch();
    const contexts = [];
    for (const user of users) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${app.origin}/ingresar`);
      await page.getByLabel("Correo electrónico").fill(user.email);
      await page.getByLabel("Contraseña", { exact: true }).fill(password);
      await page.getByRole("button", { name: "Ingresar", exact: true }).click();
      await page.waitForURL("**/cuenta");
      contexts.push(context);
    }
    const [desk, owner, other] = contexts;
    const guest = await browser.newContext();
    const [period, invalidPeriod, abandonedPeriod] = users[1].periods;
    const api = `${app.origin}/api/comprobantes`;
    const send = (context, data) => context.request.post(api, { headers: { origin: app.origin }, data });
    const get = (context, id) => context.request.get(`${api}?id=${id}`, { maxRedirects: 0 });
    const valid = await validPdfFixture();
    const dataFor = (periodId, bytes) => ({
      action: "prepare", period: periodId, id: randomUUID(), type: "application/pdf", extension: "pdf",
      size: bytes.length, hash: createHash("sha256").update(bytes).digest("hex"),
    });
    const put = (url, bytes, upsert = "false") => fetch(url, {
      method: "PUT", body: bytes, headers: { "Content-Type": "application/pdf", "x-upsert": upsert },
    });

    const payload = dataFor(period, valid);
    check("anonymous_prepare_denied", (await send(guest, payload)).status() === 403);
    check("cross_member_prepare_denied", (await send(other, payload)).status() === 403);
    const attempts = [payload, ...Array.from({ length: 24 }, () => dataFor(period, valid))];
    const replies = await Promise.all(attempts.map(data => send(owner, data)));
    const winner = replies.findIndex(reply => reply.ok());
    const statuses = replies.map(reply => reply.status());
    check("one_signature_for_25_parallel_operations", winner >= 0 && statuses.filter(s => s === 200).length === 1
      && statuses.filter(s => s === 409).length === 24, statuses.join(","));
    const chosen = attempts[winner];
    const lease = await replies[winner].json();
    const retry = await (await send(owner, chosen)).json();
    check("same_operation_same_lease_and_path", retry.uploadId === lease.uploadId
      && new URL(retry.uploadUrl).pathname === new URL(lease.uploadUrl).pathname);
    check("signed_upload_real_storage", (await put(lease.uploadUrl, valid)).ok);
    check("signed_token_cannot_overwrite", !(await put(lease.uploadUrl, forgedXrefFixture(), "true")).ok);
    const stagedPath = `${users[1].id}/${period}/${lease.uploadId}.pdf`;
    check("staging_private", (await get(owner, chosen.id)).status() === 403);
    const uploaded = await (await send(owner, chosen)).json();
    check("retry_after_upload_reuses_object", uploaded.uploaded && uploaded.uploadId === lease.uploadId && !uploaded.uploadUrl);
    const finalize = { ...chosen, action: "submit", uploadId: lease.uploadId };
    check("cross_member_finalize_denied", (await send(other, finalize)).status() === 403);
    const receipts = await Promise.all([send(owner, finalize), send(owner, finalize)]);
    check("concurrent_finalize_exact_retry", receipts.every(reply => reply.ok())
      && sql(`select count(*) from public.cueva_payment_receipts where period_id='${period}' and state='pending'`) === "1",
      receipts.map(reply => reply.status()).join(","));
    check("no_money_before_admin_review", sql(`select count(*) from public.cueva_payments where period_id='${period}'`) === "0");
    check("cross_member_download_denied", (await get(other, chosen.id)).status() === 403);
    check("anonymous_download_denied", (await get(guest, chosen.id)).status() === 403);
    const otherSession = await (await request(`${base}/token?grant_type=password`, {
      method: "POST", body: { email: users[2].email, password },
    })).json();
    check("cross_member_raw_storage_denied", typeof otherSession.access_token === "string"
      && !(await request(`${storageBase}/object/authenticated/${bucket}/${stagedPath}`, { token: otherSession.access_token })).ok);
    check("bucket_has_no_public_download", !(await request(`${storageBase}/object/public/${bucket}/${stagedPath}`)).ok);
    for (const [role, context] of [["owner", owner], ["admin", desk]]) {
      const response = await get(context, chosen.id);
      check(`${role}_gets_signed_redirect`, response.status() === 307 && response.headers().location?.startsWith(storageOrigin),
        String(response.status()));
      const file = await request(response.headers().location);
      check(`${role}_download_matches_original_bytes`, file.ok && Buffer.from(await file.arrayBuffer()).equals(valid));
    }

    const forged = forgedXrefFixture();
    const invalid = dataFor(invalidPeriod, forged);
    const invalidLease = await (await send(owner, invalid)).json();
    check("untrusted_invalid_file_reaches_storage", (await put(invalidLease.uploadUrl, forged)).ok);
    check("invalid_finalize_returns_422", (await send(owner, { ...invalid, action: "submit", uploadId: invalidLease.uploadId })).status() === 422);
    check("invalid_file_creates_no_receipt", sql(`select count(*) from public.cueva_payment_receipts where period_id='${invalidPeriod}'`) === "0");
    check("invalid_file_is_not_resigned", (await send(owner, invalid)).status() === 422);

    const abandoned = dataFor(abandonedPeriod, valid);
    const oldLease = await (await send(owner, abandoned)).json();
    check("abandoned_fixture_uploaded", (await put(oldLease.uploadUrl, valid)).ok);
    const cleanup = `${api}/limpieza`;
    check("cleanup_requires_secret", (await guest.request.get(cleanup)).status() === 403);
    const sweep = () => guest.request.get(cleanup, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    const beforeExpiry = await sweep();
    check("cleanup_ignores_active_leases", beforeExpiry.ok() && (await beforeExpiry.json()).removed === 0);
    // Advance only the DB lease in the isolated test to exercise the cleanup
    // paths. Production leases include the full Storage token lifetime.
    sql(`update cueva_private.receipt_uploads set expires_at=clock_timestamp()-interval '1 minute'
      where period_id in ('${invalidPeriod}', '${abandonedPeriod}')`);
    const fresh = await (await send(owner, invalid)).json();
    check("lazy_cleanup_allocates_fresh_nonce", fresh.uploadId && fresh.uploadId !== invalidLease.uploadId);
    check("stale_finalize_cannot_use_new_lease", (await send(owner, { ...invalid, action: "submit", uploadId: invalidLease.uploadId })).status() === 409);
    const cleaned = await sweep();
    check("scheduled_cleanup_releases_abandoned_lease", cleaned.ok() && (await cleaned.json()).removed === 1,
      String(cleaned.status()));
    check("real_storage_objects_removed", sql(`select count(*) from storage.objects where bucket_id='${bucket}'`) === "1");
    const afterCleanup = await (await send(owner, abandoned)).json();
    check("abandoned_operation_can_retry_on_new_path", afterCleanup.uploadId && afterCleanup.uploadId !== oldLease.uploadId);
    check("associated_file_survives_cleanup", (await get(owner, chosen.id)).status() === 307);
  } finally {
    await browser?.close();
    await app?.close();
    if (gateway) await new Promise(resolve => gateway.close(resolve));
    delete process.env.CUEVA_LAB_STORAGE_ORIGIN;
    delete process.env.CRON_SECRET;
  }
}

