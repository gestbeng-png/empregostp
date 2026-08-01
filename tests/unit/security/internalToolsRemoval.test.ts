import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REMOVED_PRODUCTION_ROUTES = [
  'pages/api/create-admin.js',
  'pages/api/debug-user.js',
];

describe('ferramentas internas no artefacto de produção', () => {
  test('não inclui endpoints de criação de admin ou inspeção de utilizador', () => {
    const existingRoutes = REMOVED_PRODUCTION_ROUTES.filter((route) =>
      existsSync(resolve(process.cwd(), route)),
    );

    expect(existingRoutes).toEqual([]);
  });
});
