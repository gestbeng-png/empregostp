import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUNDLE_METHOD,
  bundleRegressions,
  initialJavascriptFiles,
} from '../../scripts/v2/bundle-budget.mjs';

const report = (gzipBytes) => ({
  method: BUNDLE_METHOD,
  routes: { '/': { gzipBytes } },
});
test('initial chunks include app, route and manifests once; exclude CSS and nomodule polyfills', () => {
  assert.deepEqual(
    initialJavascriptFiles(
      {
        pages: {
          '/_app': ['framework.js', 'app.js', 'app.css'],
          '/': ['framework.js', 'home.js', 'home.css'],
        },
        lowPriorityFiles: ['manifest.js'],
        polyfillFiles: ['old-browser.js'],
      },
      '/',
    ),
    ['framework.js', 'app.js', 'home.js', 'manifest.js'],
  );
});
test('missing routes fail closed instead of returning a zero-byte pass', () => {
  assert.throws(
    () => initialJavascriptFiles({ pages: { '/_app': [] } }, '/'),
    /MISSING_ROUTE/,
  );
});
test('170 KB absolute budget rejects a single extra byte', () => {
  assert.deepEqual(bundleRegressions(report(170_000)), []);
  assert.equal(
    bundleRegressions(report(170_001))[0].code,
    'ABSOLUTE_BUDGET_EXCEEDED',
  );
});
test('baseline +10% is enforced independently from the absolute budget', () => {
  assert.deepEqual(bundleRegressions(report(110_000), report(100_000)), []);
  assert.equal(
    bundleRegressions(report(110_001), report(100_000))[0].code,
    'BASELINE_GROWTH_EXCEEDED',
  );
});
test('baselines with a different method or incomplete routes cannot waive limits', () => {
  assert.throws(
    () => bundleRegressions(report(10), { method: 'other' }),
    /INCOMPATIBLE/,
  );
  assert.throws(
    () => bundleRegressions(report(10), { method: BUNDLE_METHOD, routes: {} }),
    /MISSING_BASELINE/,
  );
});
