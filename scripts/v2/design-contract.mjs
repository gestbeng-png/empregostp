import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

export const TOKEN_FILES = new Set([
  'styles/globals.css',
  'styles/workbridge-theme.css',
  'styles/dashboard-shell.css',
]);
const pixels = /\b(?:\d*\.)?\d+px\b/g;
const colors = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/gi;
const dimensions =
  /^(?:width|height|minWidth|maxWidth|minHeight|maxHeight|fontSize|padding(?:Top|Bottom|Left|Right|Inline|Block)?|margin(?:Top|Bottom|Left|Right|Inline|Block)?|gap|rowGap|columnGap|top|bottom|left|right|borderRadius|borderWidth)$/;

export function extractDesignLiterals(file, source) {
  if (TOKEN_FILES.has(file)) return {};
  const literals = {};
  const count = (kind, text) => {
    const key = `${kind}:${text}`;
    literals[key] = (literals[key] || 0) + 1;
  };
  const scan = (text) => {
    for (const value of text.match(colors) || [])
      count('color', value.toLowerCase());
    for (const value of text.match(pixels) || [])
      if (Number.parseFloat(value) !== 0) count('px', value);
  };
  if (file.endsWith('.css')) scan(source.replace(/\/\*[\s\S]*?\*\//g, ''));
  else {
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') || file.endsWith('.jsx') || file.endsWith('.js')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        if (!(
          ts.isJsxAttribute(node.parent) &&
          ['id', 'href', 'src'].includes(node.parent.name.getText(tree))
        ))
          scan(node.text);
      }
      if (
        ts.isJsxAttribute(node) &&
        node.name.getText(tree) === 'style' &&
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression &&
        ts.isObjectLiteralExpression(node.initializer.expression)
      ) {
        for (const property of node.initializer.expression.properties) {
          if (
            ts.isPropertyAssignment(property) &&
            dimensions.test(property.name.getText(tree)) &&
            ts.isNumericLiteral(property.initializer) &&
            Number(property.initializer.text) !== 0
          )
            count(
              'numeric-style',
              `${property.name.getText(tree)}=${property.initializer.text}`,
            );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return literals;
}
async function filesIn(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const file = path.posix.join(directory, entry.name);
        return entry.isDirectory()
          ? filesIn(file)
          : /\.(?:css|[jt]sx?)$/.test(file)
            ? [file]
            : [];
      }),
    )
  ).flat();
}
export async function currentDesignLiterals() {
  const files = (
    await Promise.all(
      ['components', 'pages', 'styles', 'presentation'].map(filesIn),
    )
  )
    .flat()
    .filter((file) => !file.startsWith('pages/api/') && !TOKEN_FILES.has(file));
  return Object.fromEntries(
    await Promise.all(
      files
        .sort()
        .map(async (file) => [
          file,
          extractDesignLiterals(file, await readFile(file, 'utf8')),
        ]),
    ),
  );
}
export function findDesignRegressions(current, baseline) {
  return Object.entries(current).flatMap(([file, values]) =>
    Object.entries(values)
      .filter(([literal, count]) => count > (baseline[file]?.[literal] || 0))
      .map(([literal, count]) => ({
        file,
        literal,
        count,
        allowed: baseline[file]?.[literal] || 0,
      })),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve('scripts/v2/design-contract.mjs')
) {
  const baseline = JSON.parse(
    await readFile('tests/unit/design/design-literals-baseline.json', 'utf8'),
  );
  const regressions = findDesignRegressions(
    await currentDesignLiterals(),
    baseline,
  );
  if (regressions.length) {
    process.stderr.write(`${JSON.stringify({ regressions }, null, 2)}\n`);
    process.exitCode = 1;
  } else
    process.stdout.write(
      'Design contract: sem novos valores literais de cores/px.\n',
    );
}
