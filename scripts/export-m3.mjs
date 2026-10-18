// Export a draft from authoritative Markdown. Final mode fails closed until release evidence exists.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '../frontend/node_modules/playwright-core/index.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
if (args.some(a => !['--final'].includes(a))) throw new Error('Usage: node scripts/export-m3.mjs [--final]');
const final = args.includes('--final');
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
const source = readFileSync(path.join(root, 'docs/ui.md'), 'utf8');
const head = git('rev-parse', 'HEAD');
if (final) {
  if (git('branch', '--show-current') !== 'main' || git('status', '--porcelain')) throw new Error('Final export requires a clean main checkout.');
  if (head !== git('rev-parse', 'origin/main')) throw new Error('Refresh origin/main and use its merged HEAD before final export.');
  if (/HUMAN REQUIRED|Submission status: DRAFT/.test(source)) throw new Error('Missing human assets/details or draft status; final export refused.');
  const releasePath = path.join(root, 'docs/evidence/s3-c05-ui/release.json');
  if (!existsSync(releasePath)) throw new Error('Final export requires a reviewed release.json evidence record; see C05 README.');
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  if (!release.mergedDocumentationPr || !release.independentReviewUrl || !release.acceptanceRecord || !release.wrapUpRecord || !release.finalCandidateCaptureRecord) throw new Error('Release record is incomplete.');
}
const out = path.join(root, 'frontend/test-results/m3-dossier');
mkdirSync(out, { recursive: true });
const htmlPath = path.join(out, 'Team03_M3.html');
const python = process.env.M3_PYTHON || (existsSync(path.join(root, '.venv/bin/python')) ? path.join(root, '.venv/bin/python') : 'python');
execFileSync(python, [path.join(root, 'scripts/render-m3.py'), '--output', htmlPath], { cwd: root, stdio: 'inherit' });
const browser = await chromium.launch(process.env.M3_BROWSER_PATH ? { executablePath: process.env.M3_BROWSER_PATH, headless: true } : { headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/*', route => /^(file|data):/.test(route.request().url()) ? route.continue() : route.abort());
  await page.goto(pathToFileURL(htmlPath).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
  const dimensions = await page.evaluate(() => [...document.querySelectorAll('.sheet')].map((sheet, i) => ({ sheet: i+1, height: sheet.getBoundingClientRect().height, width: sheet.getBoundingClientRect().width })));
  const pdfPath = final ? path.join(root, 'Team03_M3.pdf') : path.join(out, 'Team03_M3.draft.pdf');
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;padding:0 14mm;font:8px Arial;color:#475569;display:flex;justify-content:space-between"><span>${final ? 'MERGED EXPORT' : 'DRAFT · NOT FOR SUBMISSION'} · ${head.slice(0,12)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
  if (!final) {
    const flow = await browser.newPage();
    await flow.goto(pathToFileURL(path.join(root, 'docs/images/ui/screen-flow.svg')).href);
    const diagramPdf = path.join(out, 'screen-flow.pdf');
    await flow.pdf({ path: diagramPdf, width:'1080px', height:'1140px', printBackground:true, margin:{top:0,bottom:0,left:0,right:0} });
    execFileSync(python, [path.join(root, 'scripts/render-m3.py'), '--diagram-pdf', diagramPdf, '--output', path.join(out,'screen-flow.png')], { cwd:root, stdio:'inherit' });
  }
  const report = { mode:final ? 'merged export; manual release verification still required' : 'draft; not a submission', source:'docs/ui.md', sourceSha256:createHash('sha256').update(source).digest('hex'), checkoutHead:head, workingTree:git('status','--porcelain'), pdf:path.relative(root,pdfPath), pdfSha256:createHash('sha256').update(readFileSync(pdfPath)).digest('hex'), sourceSheets:dimensions, missingHumanMarkers:(source.match(/HUMAN REQUIRED/g)||[]).length, network:'external requests blocked', browser:browser.version() };
  writeFileSync(path.join(out,'export.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Created ${path.relative(root,pdfPath)}. Final export ${final ? 'requires human comparison with merged main' : 'remains pending'}.`);
} finally { await browser.close(); }
