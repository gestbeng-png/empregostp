import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  currentDesignLiterals,
  extractDesignLiterals,
  findDesignRegressions,
} from '../../scripts/quality/design-contract.mjs';

test('CSS: tokens, comments and zero are allowed; nonzero px and full colors are counted', () => {
  assert.deepEqual(
    extractDesignLiterals(
      'styles/New.module.css',
      '/* #fff 99px */ .a { color: var(--dash-blue); padding: 0px 12px; border: thin solid rgba(0, 0, 0, .2); }',
    ),
    { 'px:12px': 1, 'color:rgba(0, 0, 0, .2)': 1 },
  );
  assert.deepEqual(
    extractDesignLiterals(
      'styles/globals.css',
      '.a { color: #fff; width: 20px; }',
    ),
    {},
  );
});
test('TSX: inline numeric dimensions and literal strings are guarded; IDs are not colors', () => {
  assert.deepEqual(
    extractDesignLiterals(
      'components/New.tsx',
      'const x = <div id="#abc" style={{ width: 32, margin: 0, background: "#ABC", height: "12px" }} />;',
    ),
    { 'numeric-style:width=32': 1, 'color:#abc': 1, 'px:12px': 1 },
  );
});
test('JSX template strings are scanned; comments are ignored', () => {
  assert.deepEqual(
    extractDesignLiterals(
      'pages/new.js',
      '// #fff 40px\nconst x = `1px solid ${token}`;',
    ),
    { 'px:1px': 1 },
  );
});
test('replacing a legacy literal is rejected even when total count stays constant', () => {
  assert.deepEqual(
    findDesignRegressions(
      { a: { 'color:#eee': 1 } },
      { a: { 'color:#fff': 1 } },
    ),
    [{ file: 'a', literal: 'color:#eee', count: 1, allowed: 0 }],
  );
});
test('new files and extra occurrences have zero/legacy allowance; removals are allowed', () => {
  assert.equal(
    findDesignRegressions(
      { a: { 'px:12px': 2 }, b: { 'px:12px': 1 } },
      { a: { 'px:12px': 1 } },
    ).length,
    2,
  );
  assert.deepEqual(
    findDesignRegressions({ a: {} }, { a: { 'px:12px': 1 } }),
    [],
  );
});
test('current UI does not introduce literals beyond the reviewed legacy baseline', async () => {
  const baseline = JSON.parse(
    await readFile(
      new URL('../unit/design/design-literals-baseline.json', import.meta.url),
      'utf8',
    ),
  );
  assert.deepEqual(
    findDesignRegressions(await currentDesignLiterals(), baseline),
    [],
  );
});
