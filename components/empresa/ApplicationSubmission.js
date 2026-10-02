import { useState } from 'react';
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_YEARS_OPTIONS,
  LANGUAGE_LEVEL_OPTIONS,
  REFERRAL_SOURCE_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
  labelDe,
} from '../../lib/applicationForm';
import { documentTypeById } from '../../lib/applicationDocuments';
import { openApplicationDocument } from '../../lib/candidateCvClient';
import styles from '../../styles/ApplicationSubmission.module.css';

/**
 * Tudo o que o candidato enviou numa candidatura, num só sítio.
 *
 * Vive num componente partilhado porque é mostrado em dois lados — a ficha da
 * vaga e a ficha do candidato — e a informação tem de ser exatamente a mesma
 * nos dois. Só mostra os blocos com conteúdo: candidaturas anteriores ao
 * formulário completo não têm nada disto.
 *
 * @param {{
 *   applicationId?: string,
 *   coverLetter?: string,
 *   form?: Record<string, any> | null,
 *   documents?: Array<{ type: string, files: Array<{ name: string }> }>,
 *   requiredDocuments?: Array<{ id: string, label: string }>,
 *   assessment?: Record<string, any> | null,
 *   hideContact?: boolean,
 * }} props
 */
export default function ApplicationSubmission({
  applicationId,
  coverLetter = '',
  form = null,
  documents = [],
  requiredDocuments = [],
  assessment = null,
  hideContact = false,
}) {
  const [erro, setErro] = useState('');
  const [aAbrir, setAAbrir] = useState('');

  const dados = form || {};
  // O email e o telefone repetem o que a página já esconde consoante o plano.
  // Mostrá-los aqui seria uma porta das traseiras para a mesma informação.
  const linhas = [
    ['Telefone', hideContact ? '' : dados.phone],
    ['Email', hideContact ? '' : dados.email],
    ['Localização', dados.location],
    ['Nacionalidade', dados.nationality],
    ['Data de nascimento', dados.birthDate],
    [
      'Autorização de trabalho',
      labelDe(dados.workAuthorization, WORK_AUTHORIZATION_OPTIONS),
    ],
    [
      'Anos de experiência',
      labelDe(dados.experienceYears, EXPERIENCE_YEARS_OPTIONS),
    ],
    ['Disponibilidade', labelDe(dados.availability, AVAILABILITY_OPTIONS)],
    [
      'Pretensão salarial',
      dados.salaryExpectation ? `${dados.salaryExpectation} Dbs/mês` : '',
    ],
    [
      'Como soube da vaga',
      labelDe(dados.referralSource, REFERRAL_SOURCE_OPTIONS),
    ],
  ].filter(([, valor]) => valor);

  const formacao = Array.isArray(dados.education) ? dados.education : [];
  const idiomas = Array.isArray(dados.languages) ? dados.languages : [];
  const referencias = Array.isArray(dados.references) ? dados.references : [];

  const etiquetaDe = (tipo) =>
    requiredDocuments?.find((item) => item.id === tipo)?.label ||
    documentTypeById(tipo)?.label ||
    tipo;

  const abrir = async (tipo, indice) => {
    setErro('');
    setAAbrir(`${tipo}-${indice}`);
    const resultado = await openApplicationDocument(
      applicationId,
      tipo,
      indice,
    );
    if (!resultado.success) setErro(resultado.error);
    setAAbrir('');
  };

  const temAlgo =
    linhas.length ||
    formacao.length ||
    idiomas.length ||
    referencias.length ||
    documents.length ||
    coverLetter ||
    assessment;

  if (!temAlgo) return null;

  return (
    <div className={styles.wrap}>
      {assessment ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Teste de competências</h4>
          <p className={styles.assessment}>
            {assessment.correctAnswers}/{assessment.totalQuestions} corretas
            {typeof assessment.score === 'number'
              ? ` — ${assessment.score}%`
              : ''}
            {assessment.passed === true ? ' · Aprovado' : ''}
            {assessment.passed === false ? ' · Reprovado' : ''}
          </p>
        </section>
      ) : null}

      {linhas.length ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Dados da candidatura</h4>
          <dl className={styles.grid}>
            {linhas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className={styles.row}>
                <dt>{etiqueta}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {coverLetter ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Carta de motivação</h4>
          <p className={styles.letter}>{coverLetter}</p>
        </section>
      ) : null}

      {formacao.length ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Formação académica</h4>
          <ul className={styles.list}>
            {formacao.map((item, indice) => (
              <li key={indice}>
                {[item.degree, item.institution, item.year]
                  .filter(Boolean)
                  .join(' — ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {idiomas.length ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Idiomas</h4>
          <ul className={styles.list}>
            {idiomas.map((item, indice) => (
              <li key={indice}>
                {[item.language, labelDe(item.level, LANGUAGE_LEVEL_OPTIONS)]
                  .filter(Boolean)
                  .join(' — ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {referencias.length ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Referências</h4>
          <ul className={styles.list}>
            {referencias.map((item, indice) => (
              <li key={indice}>
                {[item.name, item.role, item.company, item.contact]
                  .filter(Boolean)
                  .join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {documents.length ? (
        <section className={styles.block}>
          <h4 className={styles.blockTitle}>Documentos entregues</h4>
          {documents.map((documento) => (
            <div key={documento.type} className={styles.docGroup}>
              <span className={styles.docLabel}>
                {etiquetaDe(documento.type)}
              </span>
              {documento.files.map((ficheiro, indice) => (
                <button
                  key={indice}
                  type="button"
                  className={styles.docButton}
                  onClick={() => abrir(documento.type, indice)}
                  disabled={aAbrir === `${documento.type}-${indice}`}
                >
                  {aAbrir === `${documento.type}-${indice}`
                    ? 'A abrir…'
                    : `📎 ${ficheiro.name}`}
                </button>
              ))}
            </div>
          ))}
          {erro ? (
            <p className={styles.error} role="alert">
              {erro}
            </p>
          ) : null}
        </section>
      ) : null}

      {dados.consentSimilarJobs ? (
        <p className={styles.consent}>
          ✓ Aceita ser contactado sobre vagas semelhantes.
        </p>
      ) : null}
    </div>
  );
}

/** O que serializar de uma candidatura para este componente. */
export function serializeApplicationSubmission(data = {}) {
  // `documents` sai do formulário de propósito: traz os URLs permanentes do
  // Storage e iria parar ao __NEXT_DATA__ do HTML, onde qualquer pessoa com a
  // página os leria para sempre. Abaixo só viajam os nomes; a abertura passa
  // pela rota que assina um URL de curta duração.
  const { documents: _documentosComUrls, ...formularioSemUrls } =
    data.applicationForm || {};

  return {
    coverLetter: data.coverLetter || '',
    applicationForm: data.applicationForm ? formularioSemUrls : null,
    // Só os nomes: os URLs permanentes ficam no servidor e cada abertura
    // passa pela rota que assina um URL de curta duração.
    documents: Object.entries(data.applicationForm?.documents || {}).map(
      ([tipo, valor]) => ({
        type: tipo,
        files: (Array.isArray(valor) ? valor : [valor]).map((ficheiro) => ({
          name: ficheiro?.name || 'documento',
        })),
      }),
    ),
    requiredDocuments: Array.isArray(data.requiredDocuments)
      ? data.requiredDocuments
      : [],
    assessment: data.skillsAssessmentResult || null,
  };
}
