import fs from 'node:fs';
import path from 'node:path';

import {
  internalFieldsIn,
  JOB_INTERNAL_FIELDS,
  JOB_INTERNALS_COLLECTION,
  splitJobWrite,
} from '@/domain/jobs/internalFields';

import { projectPublicJob } from '../../../lib/publicJob';

const rules = fs.readFileSync(
  path.join(process.cwd(), 'firestore.rules'),
  'utf8',
);

/** Corpo do bloco `match /<colecao>/{...} { ... }` nas regras. */
function ruleBlock(collection: string): string | null {
  const start = rules.search(
    new RegExp(`match /${collection}/\\{[^}]+\\}\\s*\\{`),
  );
  if (start < 0) return null;
  let depth = 0;
  for (
    let index = rules.indexOf('{', rules.indexOf('}', start));
    index < rules.length;
    index++
  ) {
    if (rules[index] === '{') depth++;
    if (rules[index] === '}' && --depth === 0)
      return rules.slice(start, index + 1);
  }
  return null;
}

const internalJob = {
  id: 'job-1',
  titulo: 'Contabilista',
  companyId: 'org-a',
  status: 'active',
  riskScore: 87,
  riskSignals: ['pede_pagamento'],
  moderationNotes: 'Suspeita de fraude — confirmar NIF',
  moderationDecisionReason: 'x',
  duplicateOfJobId: 'job-0',
  qualityScore: 40,
  qualityBreakdown: { salary: 0 },
  onBehalfOfClient: 'Banco Exemplo, S.A.',
};

describe('SEC-04 — dados internos das vagas', () => {
  it('a projeção pública nunca devolve campos internos', () => {
    const projected = projectPublicJob(internalJob);
    expect(internalFieldsIn(projected)).toEqual([]);
    expect(JSON.stringify(projected)).not.toContain('Banco Exemplo');
    expect(JSON.stringify(projected)).not.toContain('fraude');
  });

  it('separa uma escrita em documento público e documento interno', () => {
    const { publicFields, internalFields } = splitJobWrite(internalJob);
    expect(internalFieldsIn(publicFields)).toEqual([]);
    expect(Object.keys(internalFields).sort()).toEqual(
      [...JOB_INTERNAL_FIELDS].sort(),
    );
    expect(publicFields).toMatchObject({ id: 'job-1', titulo: 'Contabilista' });
  });

  it('as APIs de candidato passam as vagas pela allowlist', () => {
    for (const route of [
      'pages/api/saved-jobs.js',
      'pages/api/recommendations.js',
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), route), 'utf8');
      expect(source).toContain('projectPublicJob(job)');
      expect(source).not.toMatch(/\{\s*\.\.\.job,\s*(savedAt|score)/);
    }
  });

  it('o browser já não lê a coleção de vagas diretamente', () => {
    const block = ruleBlock('jobs');
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/allow read:\s*if true/);
    expect(block).toMatch(/isAdmin\(\)/);
  });

  it('a coleção de campos internos não tem nenhuma regra allow', () => {
    expect(ruleBlock(JOB_INTERNALS_COLLECTION)).toBeNull();
    expect(rules).toMatch(
      /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/,
    );
  });
});

describe('SEC-05 — conteúdo premium', () => {
  it('resources_premium não é legível pelo browser', () => {
    const block = ruleBlock('resources_premium');
    expect(block).not.toBeNull();
    expect(block).not.toMatch(/allow read:\s*if true/);
  });
});

describe('leitura pública nas regras é deliberada', () => {
  it('só as coleções de conteúdo público têm leitura aberta', () => {
    const publicCollections = [
      ...rules.matchAll(/match \/([a-zA-Z_]+)\/\{[^}]+\}\s*\{([^}]*)\}/g),
    ]
      .filter(([, , body]) => /allow read:\s*if true;/.test(body ?? ''))
      .map(([, name]) => name)
      .sort();

    expect(publicCollections).toEqual(
      [
        'news',
        'plans',
        'platform_stats',
        'posts',
        'resources_courses',
        'resources_faqs',
        'resources_foreigners',
        'resources_guides',
        'resources_links',
        'resources_mentors',
        'resources_services',
        'resources_templates',
        'resources_testimonials',
        'resources_tools',
        'services',
      ].sort(),
    );
  });
});
