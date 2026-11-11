# C02 private backup storage and independent restore

Status: **local regional backup created/restored and verified; durable upload,
operator download/access and independent human restore are not yet done**.
Primary backup operator: @hoang3003; backup: @NguyenTuanAnh0608.
The PO requested this guide after confirming no shared destination exists.

## 1. Files prepared privately

The operator's ignored `.venv/private-backups` directory contains:

- `runtime-regional-current-20261111T150435Z.dump`
- `runtime-regional-current-20261111T150435Z.dump.sha256`

This snapshot is PostgreSQL 18/head `d9a6f2c1e508`, 989 movies, provider data for
US/GB/SG and all 13 public tables (12 application tables plus Alembic). It was
restored into a separate local PostgreSQL 18 database and every table digest
matched the exported source snapshot. [Credential-free verification](evidence/s5-c02/regional-backup-verification.json).
It captures its recorded point in time, not writes made afterward.

Keep both files private. A dump contains account/password-hash/session data;
no archive, real user row, password or private URI goes into GitHub, a release
asset, LMS or the public submission PDF. Git contains only the runbook and
sanitized verification. Do not use Render's ephemeral filesystem as storage.

## 2. Set up a durable restricted folder

On Google Drive, create a private folder such as **CineAI-Private-Backups**.
Upload both files using **New → File upload**. Open **Share**, set **General
access → Restricted**, and add only the actual Google accounts of the named
operators. Kiet may own the folder; Hoang needs permission to upload daily
backups. Nguyen Tuan Anh must at least be able to download for restore, and
needs upload permission if performing backup duties. Do not choose Anyone
with the link or a public class folder. Check the actual access using each
person's own signed-in identity, not only the owner's screen.

Official instructions: [upload files](https://support.google.com/drive/answer/2424368?hl=en)
and [restricted sharing/access roles](https://support.google.com/drive/answer/7166529?hl=en).
A private OneDrive/team storage destination can serve the same purpose if both
operators verify its access and persistence. This guide does not claim either
provider has been configured for the team.

After upload, the backup operator downloads both files to their own machine and
checks the checksum locally. In PowerShell, from that download directory:

```powershell
$backupFile = (Resolve-Path '.\runtime-regional-current-20261111T150435Z.dump').Path
(Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
Get-Content -LiteralPath ($backupFile + '.sha256')
```

The hashes must match (case-insensitive). The verified snapshot's digest is
`68fbe33839d5e25933474dc9670317c9ff4806a1116b3afd4a204c60433a5420`.

## 3. Another member restores on their own machine

Use PostgreSQL **18** tools and a **new empty local database**, never `neondb`
or the public Render/Neon database. The example below assumes the tester's own
local PostgreSQL on 127.0.0.1:5432 and local user postgres. Adjust those local
settings as needed; enter that local password when prompted. Choose a database
name that does not already exist. No shared-production password is needed.

```powershell
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
& "$pgBin\createdb.exe" -h 127.0.0.1 -p 5432 -U postgres -W --template=template0 --encoding=UTF8 --locale=C c02_restore_check_20261111
if ($LASTEXITCODE -ne 0) { throw 'Empty restore database was not created' }
& "$pgBin\pg_restore.exe" --exit-on-error --no-owner --no-privileges -h 127.0.0.1 -p 5432 -U postgres -W --dbname=c02_restore_check_20261111 "$backupFile"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; do not accept this target' }
& "$pgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -W -d c02_restore_check_20261111
```

Inside the local psql prompt:

```sql
SELECT version_num FROM alembic_version;
SELECT count(*) FROM pg_tables WHERE schemaname = 'public';
SELECT count(*) FROM catalog_movies m JOIN catalogue_state s
  ON m.catalogue_revision_id = s.active_revision_id;
SELECT country, status, count(*) FROM movie_provider_checks
  GROUP BY country, status ORDER BY country, status;
SELECT country, count(*) FROM movie_watch_providers GROUP BY country ORDER BY country;
```

Expected for this particular archive: head `d9a6f2c1e508`, 13 tables, 989 active
movies; US 904 success/85 no-data, GB 859/130, SG 706/283. Memberships:
US 11,278, GB 8,728, SG 1,459. Later genuine archives can have different counts.

Use the [full T06 procedure](s5-t06-postgresql-recovery.md#restore-to-a-separate-postgresql-target)
for Alembic check, validated constraints, source-manifest/comparator, isolated
index rebuild/check and local application health/account/provider inspection.
Do not point an application at a partially restored database. `--no-privileges`
means grants must be reapplied if testing a separate runtime role. Keep the
archive/source manifest comparison tied to the snapshot; later public writes
can legitimately differ from an earlier backup.

## 4. Operating schedule and receipt

Hoang owns a consistent daily logical backup after public writes and a new
backup before schema/provider-data changes; Nguyen Tuan Anh is fallback. Use
[T06 backup instructions](s5-t06-postgresql-recovery.md#preflight-and-backup),
not a new TMDb import. Upload each successful dated archive and checksum,
verify access/download, keep the latest seven successful archives and the last
known-good pre-change backup until a replacement has passed restore checks.
The schedule is a commitment until actual execution/acknowledgement is supplied.

Send C02 only: storage provider/private-folder designation (no public link or
credentials), primary/backup names, actual upload/download/checksum date,
independent tester/date/local PostgreSQL version, restore/head/989-movie/regional
results, and acknowledgement of schedule/retention. Keep raw archives, ACL
screenshots exposing emails and user data private. Mark Pending until done;
the agent's local verification does not establish a teammate's reproduction.
