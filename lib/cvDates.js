// Formatação dos períodos do currículo.
//
// O CV mostra apenas anos ("2022 - 2024"), não meses: é o que se espera num
// currículo e o que mantém a coluna de datas estreita e alinhada.

/** Extrai o ano de "AAAA-MM", "AAAA-MM-DD" ou "AAAA". */
export function anoDe(valor) {
  const bruto = String(valor ?? '').trim();
  const correspondencia = /^(\d{4})/.exec(bruto);
  return correspondencia ? correspondencia[1] : '';
}

/**
 * Formata um período em anos.
 *
 *   ('2022-03', '2024-08')        -> '2022 - 2024'
 *   ('2022-03', '', true)         -> '2022 - atual'
 *   ('2022-03', '2022-11')        -> '2022'          (mesmo ano, não se repete)
 *   ('2022-03', '')               -> '2022'
 *   ('', '2024-08')               -> '2024'
 */
export function formatarIntervaloAnos(inicio, fim, atual = false) {
  const anoInicio = anoDe(inicio);
  const anoFim = atual ? 'atual' : anoDe(fim);

  if (!anoInicio && !anoFim) return '';
  if (!anoInicio) return anoFim;
  if (!anoFim) return anoInicio;
  if (anoInicio === anoFim) return anoInicio;
  return `${anoInicio} - ${anoFim}`;
}

export default formatarIntervaloAnos;
