# Checklist de validação final

Aplicar esta lista a cada rota antes de marcar como concluída.

## Estrutura e visual

- [ ] A composição original foi preservada e cada desvio está documentado.
- [ ] Alinhamentos seguem a grelha de 8 px e espaçamentos usam múltiplos de 4 px.
- [ ] Cores, sombras, raios e tipografia consomem tokens semânticos.
- [ ] Nenhum texto funcional tem menos de 14 px; notas legais justificadas têm pelo menos 12 px.
- [ ] A hierarquia de títulos é clara e não existe letter spacing negativo.
- [ ] Componentes repetidos correspondem ao sistema partilhado.

## Interação

- [ ] Hover, focus visible, active e disabled estão definidos quando aplicáveis.
- [ ] A animação dura no máximo 250 ms e respeita redução de movimento.
- [ ] Alvos touch medem pelo menos 44 por 44 px.
- [ ] Loading, vazio, erro e sucesso existem nas áreas dinâmicas aplicáveis.

## Responsividade

- [ ] 320 px sem corte, overlap ou overflow horizontal.
- [ ] 768 px sem corte, overlap ou overflow horizontal.
- [ ] 1024 px sem corte, overlap ou overflow horizontal.
- [ ] 1440 px sem corte, overlap ou densidade inadequada.

## Acessibilidade e linguagem

- [ ] Axe não encontra violações WCAG 2.1 AA automatizáveis.
- [ ] Existe um `h1`; headings, `main`, `nav` e `footer` são semânticos.
- [ ] Inputs têm labels e ícones decorativos estão ocultos da árvore acessível.
- [ ] Contraste mínimo é 4,5:1 para texto normal e 3:1 para texto grande.
- [ ] O texto segue o glossário, usa português europeu natural e não contém hífenes decorativos.

## Regressão

- [ ] Screenshot anterior e posterior foram guardados nos quatro breakpoints.
- [ ] Smoke test carrega a rota sem 500 nem erro de consola.
- [ ] Testes E2E existentes continuam aprovados.
- [ ] Typecheck, lint e build estão aprovados.
