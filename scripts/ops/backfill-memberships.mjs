// Planeamento offline de um export JSON; nunca escreve no Firebase.
import { readFile } from 'node:fs/promises';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);
const { planMembershipBackfill } = await jiti.import(
  '../../domain/memberships/Membership.ts',
);
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--input')
    throw new Error('INPUT_FILE_REQUIRED');
  const source = JSON.parse(await readFile(args[1], 'utf8'));
  if (!Array.isArray(source.users) || !Array.isArray(source.organizations))
    throw new Error('INVALID_INPUT');
  const plan = planMembershipBackfill(
    source.users,
    source.organizations,
    Date.now(),
  );
  process.stdout.write(
    `${JSON.stringify({ mode: 'DRY_RUN', proposedMemberships: plan.memberships.length, proposedOrganizations: plan.organizations.length, ambiguous: plan.ambiguous.length }, null, 2)}\n`,
  );
} catch {
  process.stderr.write(
    'Não foi possível analisar o export. Use --input ficheiro.json.\n',
  );
  process.exitCode = 1;
}
