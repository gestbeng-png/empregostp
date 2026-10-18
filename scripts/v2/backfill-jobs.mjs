// Planeamento offline de um export JSON; nunca escreve no Firebase.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const jiti = createJiti(import.meta.url, { alias: { '@': root } });
const { planJobBackfillWrite } = await jiti.import(
  path.join(root, 'domain/jobs/expand.ts'),
);
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--input')
    throw new Error('INPUT_FILE_REQUIRED');
  const jobs = JSON.parse(await readFile(args[1], 'utf8'));
  if (!Array.isArray(jobs)) throw new Error('INVALID_INPUT');
  const report = {
    mode: 'DRY_RUN',
    scanned: jobs.length,
    alreadyExpanded: 0,
    toExpand: 0,
    review: {},
  };
  for (const job of jobs) {
    const plan = planJobBackfillWrite(job);
    if (!plan) {
      report.alreadyExpanded++;
      continue;
    }
    report.toExpand++;
    for (const code of plan.review)
      report.review[code] = (report.review[code] || 0) + 1;
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch {
  process.stderr.write(
    'Não foi possível analisar o export. Use --input ficheiro.json.\n',
  );
  process.exitCode = 1;
}
