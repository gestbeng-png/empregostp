/**
 * F3.3/F3.4/H8 — perguntas de triagem e requisitos eliminatórios.
 *
 * Máximo 8 por vaga (o limite efetivo vem do entitlement SCREENING_QUESTIONS:
 * 3 no gratuito). Proibidas perguntas sobre atributos protegidos. O knockout
 * nunca rejeita: só marca a candidatura (o recrutador decide, F3.4).
 */
import { normalizePlace } from '../geo/districts';

export const SCREENING_TYPES = [
  'BOOLEAN',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'NUMBER',
  'TEXT',
] as const;
export type ScreeningType = (typeof SCREENING_TYPES)[number];
export const MAX_SCREENING_QUESTIONS = 8;
const MAX_LABEL = 200;
const MAX_OPTIONS = 10;
const MAX_TEXT_ANSWER = 1000;

export interface ScreeningQuestion {
  id: string;
  order: number;
  type: ScreeningType;
  label: string;
  options: string[];
  required: boolean;
  knockout: { expected: boolean | string | string[] | { min: number } } | null;
  maxLength: number | null;
}

/**
 * H8 — termos sobre atributos protegidos (género, idade, aparência, estado
 * civil, família, religião, etnia, nacionalidade, saúde, orientação,
 * filiação política/sindical). Sem acentos, por palavra inteira.
 */
export const PROTECTED_ATTRIBUTE_TERMS: readonly string[] = [
  'idade',
  'anos de idade',
  'data de nascimento',
  'nascido',
  'nascida',
  'jovem',
  'menos de 30',
  'menos de 35',
  'sexo',
  'genero',
  'homem',
  'mulher',
  'masculino',
  'feminino',
  'so homens',
  'so mulheres',
  'casado',
  'casada',
  'solteiro',
  'solteira',
  'estado civil',
  'divorciado',
  'divorciada',
  'filhos',
  'gravida',
  'gravidez',
  'planeia ter filhos',
  'religiao',
  'religioso',
  'igreja',
  'catolico',
  'evangelico',
  'muculmano',
  'raca',
  'etnia',
  'cor da pele',
  'origem etnica',
  'nacionalidade',
  'naturalidade',
  'boa aparencia',
  'aparencia',
  'peso',
  'altura',
  'doenca',
  'deficiencia',
  'hiv',
  'seropositivo',
  'saude mental',
  'orientacao sexual',
  'homossexual',
  'heterossexual',
  'partido',
  'filiacao politica',
  'sindicato',
  'sindicalizado',
  // FR / EN mínimos (organizações internacionais)
  'age',
  'gender',
  'married',
  'religion',
  'pregnant',
  'sexe',
  'enceinte',
];

export function detectProtectedTerms(text: string): string[] {
  const haystack = ` ${normalizePlace(text)} `;
  return PROTECTED_ATTRIBUTE_TERMS.filter((term) =>
    haystack.includes(` ${normalizePlace(term)} `),
  );
}

/** Biblioteca de perguntas frequentes (F3.3). */
export const SCREENING_LIBRARY: readonly Omit<
  ScreeningQuestion,
  'id' | 'order'
>[] = [
  {
    type: 'BOOLEAN',
    label: 'Tem carta de condução de categoria B?',
    options: [],
    required: true,
    knockout: null,
    maxLength: null,
  },
  {
    type: 'BOOLEAN',
    label: 'Tem disponibilidade imediata?',
    options: [],
    required: true,
    knockout: null,
    maxLength: null,
  },
  {
    type: 'NUMBER',
    label: 'Quantos anos de experiência tem nesta função?',
    options: [],
    required: true,
    knockout: null,
    maxLength: null,
  },
  {
    type: 'TEXT',
    label: 'Qual a sua pretensão salarial mensal (Db)?',
    options: [],
    required: false,
    knockout: null,
    maxLength: 100,
  },
  {
    type: 'BOOLEAN',
    label: 'Reside ou pode trabalhar na Ilha do Príncipe?',
    options: [],
    required: true,
    knockout: null,
    maxLength: null,
  },
  {
    type: 'BOOLEAN',
    label: 'Tem autorização para trabalhar em São Tomé e Príncipe?',
    options: [],
    required: true,
    knockout: null,
    maxLength: null,
  },
];

export type ScreeningValidation =
  | { ok: true; questions: ScreeningQuestion[] }
  | {
      ok: false;
      code:
        | 'SCREENING_LIMIT'
        | 'SCREENING_INVALID'
        | 'SCREENING_PROTECTED_ATTRIBUTE';
      message: string;
      questionIndex?: number;
      terms?: string[];
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateScreeningQuestions(
  input: unknown,
  limit: number,
): ScreeningValidation {
  if (input === undefined || input === null) return { ok: true, questions: [] };
  if (!Array.isArray(input))
    return {
      ok: false,
      code: 'SCREENING_INVALID',
      message: 'As perguntas de triagem são inválidas.',
    };
  const max = Math.min(limit, MAX_SCREENING_QUESTIONS);
  if (input.length > max)
    return {
      ok: false,
      code: 'SCREENING_LIMIT',
      message: `Pode usar até ${max} perguntas de triagem nesta vaga.`,
    };
  const questions: ScreeningQuestion[] = [];
  for (const [index, raw] of input.entries()) {
    const invalid = (): ScreeningValidation => ({
      ok: false,
      code: 'SCREENING_INVALID',
      message: `A pergunta ${index + 1} está incompleta.`,
      questionIndex: index,
    });
    if (!isRecord(raw)) return invalid();
    const type = raw.type as ScreeningType;
    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    if (
      !(SCREENING_TYPES as readonly string[]).includes(type) ||
      label.length < 5 ||
      label.length > MAX_LABEL
    )
      return invalid();
    const options = Array.isArray(raw.options)
      ? [
          ...new Set(
            raw.options
              .filter((o): o is string => typeof o === 'string')
              .map((o) => o.trim())
              .filter(Boolean),
          ),
        ].slice(0, MAX_OPTIONS)
      : [];
    if (
      (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') &&
      options.length < 2
    )
      return invalid();
    const terms = detectProtectedTerms(`${label} ${options.join(' ')}`);
    if (terms.length)
      return {
        ok: false,
        code: 'SCREENING_PROTECTED_ATTRIBUTE',
        message: `A pergunta ${index + 1} refere um atributo protegido (${terms.join(', ')}). Pergunte só o que é necessário para a função.`,
        questionIndex: index,
        terms,
      };
    let knockout: ScreeningQuestion['knockout'] = null;
    if (isRecord(raw.knockout) && 'expected' in raw.knockout) {
      const expected = raw.knockout.expected;
      if (type === 'BOOLEAN' && typeof expected === 'boolean')
        knockout = { expected };
      else if (
        type === 'SINGLE_CHOICE' &&
        typeof expected === 'string' &&
        options.includes(expected)
      )
        knockout = { expected };
      else if (
        type === 'MULTIPLE_CHOICE' &&
        Array.isArray(expected) &&
        expected.every((e) => typeof e === 'string' && options.includes(e))
      )
        knockout = { expected: expected as string[] };
      else if (
        type === 'NUMBER' &&
        isRecord(expected) &&
        Number.isFinite(expected.min)
      )
        knockout = { expected: { min: Number(expected.min) } };
      else return invalid();
    }
    questions.push({
      id:
        typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(raw.id)
          ? raw.id
          : `q${index + 1}`,
      order: index,
      type,
      label,
      options,
      required: raw.required !== false,
      knockout,
      maxLength:
        type === 'TEXT'
          ? Math.min(Number(raw.maxLength) || MAX_TEXT_ANSWER, MAX_TEXT_ANSWER)
          : null,
    });
  }
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    return {
      ok: false,
      code: 'SCREENING_INVALID',
      message: 'Há perguntas repetidas.',
    };
  return { ok: true, questions };
}

/**
 * F3.4 — knockout falha só quando a resposta contraria explicitamente o
 * esperado. Sem resposta = desconhecido, nunca falha.
 */
export function evaluateKnockout(
  questions: readonly ScreeningQuestion[],
  answers: readonly { questionId: string; value: unknown }[],
): string[] {
  const byId = new Map(answers.map((a) => [a.questionId, a.value]));
  const failed: string[] = [];
  for (const q of questions) {
    if (!q.knockout || !byId.has(q.id)) continue;
    const value = byId.get(q.id);
    const expected = q.knockout.expected;
    if (value === '' || value === null || value === undefined) continue;
    let fails = false;
    if (q.type === 'BOOLEAN')
      fails = typeof value === 'boolean' && value !== expected;
    else if (q.type === 'SINGLE_CHOICE')
      fails = typeof value === 'string' && value !== expected;
    else if (q.type === 'MULTIPLE_CHOICE')
      fails =
        Array.isArray(value) &&
        (expected as string[]).some((e) => !value.includes(e));
    else if (q.type === 'NUMBER')
      fails =
        typeof value === 'number' && value < (expected as { min: number }).min;
    if (fails) failed.push(q.id);
  }
  return failed;
}
