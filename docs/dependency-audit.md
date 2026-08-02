# Auditoria de dependências

Atualizada em 2026-07-12.

## Alterações aplicadas

- Next.js 16.2.10 e React 19.2.7.
- Firebase Admin 13.10.0, compatível com o Node 22.11 usado no ambiente local.
- TypeScript 5.9.3, ESLint 9.39.5, Jest 30.4.2 e Playwright 1.61.1.
- Zod 4.4.3, Motion 12.42.2 e Tailwind CSS 4.3.2.
- `npm audit fix` sem `--force`, removendo todos os alertas high e critical encontrados.

## Estado residual

A auditoria de produção mantém 12 alertas, 2 low e 10 moderate. A auditoria completa mantém 15 alertas, 2 low e 13 moderate.

- `nookies` depende de uma versão antiga de `cookie` e não oferece correção publicada.
- A versão estável atual do Next inclui internamente uma versão de PostCSS sinalizada; o `npm audit` propõe um downgrade inválido para Next 9, por isso a correção automática foi rejeitada.
- Firebase Admin 13 ainda herda alertas moderate das cadeias de Firestore e Storage. Firebase Admin 14 foi testado e rejeitado por quebrar o runtime Node 22.11 com `ERR_REQUIRE_ESM`.
- Firebase Tools mantém alertas apenas no conjunto de desenvolvimento.

Não foi usado `npm audit fix --force`. Estes itens devem ser revistos quando Next, Firebase Admin, Firebase Tools ou um substituto mantido para `nookies` publicarem versões compatíveis.
