// Checks tested-source.sha256 the same way on every machine.
// Each hash is SHA-256 of the file's UTF-8 bytes with CRLF turned into LF, which is
// how Git stores these text files, so a Windows checkout and a Linux checkout agree.
//   node docs/evidence/s4-t15-reset-acceptance/verify-tested-source.mjs           check
//   node docs/evidence/s4-t15-reset-acceptance/verify-tested-source.mjs --update  rewrite hashes
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const manifest = path.join(here, "tested-source.sha256");
const hashOf = file => createHash("sha256")
  .update(readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex");
const entries = readFileSync(manifest, "utf8").split("\n").filter(Boolean).map(line => {
  const match = /^([0-9a-f]{64}) {2}(.+)$/.exec(line);
  if (!match) throw new Error(`Unrecognised manifest line: ${line}`);
  return { expected: match[1], file: match[2] };
});

if (process.argv.includes("--update")) {
  writeFileSync(manifest, entries.map(({ file }) => `${hashOf(file)}  ${file}`).join("\n") + "\n", "utf8");
  console.log(`updated ${entries.length} entries`);
} else {
  const bad = entries.filter(({ file, expected }) => hashOf(file) !== expected);
  for (const { file } of bad) console.error(`MISMATCH ${file}`);
  console.log(`${entries.length - bad.length}/${entries.length} match`);
  process.exitCode = bad.length ? 1 : 0;
}
