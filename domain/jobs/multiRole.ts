import { normalizePlace as normalize } from '../geo/districts';

/**
 * F1.1 — uma função por vaga.
 *
 * `MULTIPLE` bloqueia a publicação ("Dividir em várias vagas"); `REVIEW`
 * encaminha para PENDING_REVIEW (cargo composto legítimo, ex.: "Técnico de
 * Redes e Sistemas", fica com o moderador). Dados antigos: só marcar.
 */

// Palavras que iniciam um cargo (taxonomia B10, forma normalizada).
const ROLE_HEADS = [
  'administrador',
  'administrativo',
  'agente',
  'ajudante',
  'analista',
  'arquiteto',
  'assessor',
  'assistente',
  'auditor',
  'auxiliar',
  'barman',
  'caixa',
  'canalizador',
  'carpinteiro',
  'chefe',
  'condutor',
  'consultor',
  'contabilista',
  'coordenador',
  'cozinheiro',
  'designer',
  'diretor',
  'economista',
  'educador',
  'eletricista',
  'empregado',
  'encarregado',
  'enfermeiro',
  'engenheiro',
  'estagiario',
  'farmaceutico',
  'formador',
  'gestor',
  'guarda',
  'guia',
  'jardineiro',
  'jornalista',
  'jurista',
  'mecanico',
  'medico',
  'motorista',
  'operador',
  'pedreiro',
  'pintor',
  'professor',
  'programador',
  'promotor',
  'rececionista',
  'recepcionista',
  'repositor',
  'responsavel',
  'secretaria',
  'secretario',
  'seguranca',
  'serralheiro',
  'soldador',
  'supervisor',
  'tecnico',
  'tesoureiro',
  'tradutor',
  'vendedor',
  'vigilante',
];
const HEADS = new Set(ROLE_HEADS);

export type MultiRoleVerdict = 'SINGLE' | 'REVIEW' | 'MULTIPLE';
export interface MultiRoleResult {
  verdict: MultiRoleVerdict;
  /** Títulos sugeridos para "Dividir em várias vagas". */
  parts: string[];
}

function startsWithRole(part: string): boolean {
  const first = normalize(part).split(' ')[0] ?? '';
  return HEADS.has(first);
}

function clean(title: string): string {
  return (
    title
      // Traduções e flexões entre parênteses: "(Social Media Manager)", "(a)".
      .replace(/\([^)]*\)/g, ' ')
      // Flexão de género com barra: "Empregado/a", "Técnicos/as".
      .replace(/([A-Za-zÀ-ÿ])\/(?:a|as|o|os)\b/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function detectMultipleRoles(title: string): MultiRoleResult {
  const text = clean(String(title ?? ''));
  if (!text) return { verdict: 'SINGLE', parts: [] };

  // Separadores fortes: "/", "," ou ";" entre dois cargos.
  const strong = text
    .split(/\s*[/,;|]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (strong.length > 1 && strong.filter(startsWithRole).length >= 2)
    return { verdict: 'MULTIPLE', parts: strong };

  // " e " / " ou " entre dois cargos: provável, mas pode ser composto.
  const weak = text
    .split(/\s+(?:e|ou)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (weak.length > 1 && weak.filter(startsWithRole).length >= 2)
    return { verdict: 'MULTIPLE', parts: weak };
  if (strong.length > 1 && strong.some(startsWithRole))
    return { verdict: 'REVIEW', parts: [] };

  return { verdict: 'SINGLE', parts: [] };
}
