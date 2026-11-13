import { useCallback, useEffect, useState } from 'react';
import { ActionForm, ActionStatus, useAction } from './RecruitmentControls';
import { recruitmentDate } from '../../lib/recruitmentLabels';
import styles from '../../styles/RecruitmentWorkspace.module.css';

/**
 * Propostas de emprego (API /api/applications/[id]/offers).
 *
 * A empresa prepara, envia ou retira a proposta a partir da pré-seleção ou da
 * entrevista; o candidato aceita ou recusa. Depois de aceite, a contratação
 * confirma-se no formulário «Confirmar contratação» que já existe.
 */

const ACTIVE = ['DRAFT', 'SENT', 'ACCEPTED'];

export const OFFER_STATUS_LABEL = {
  DRAFT: 'Rascunho (o candidato ainda não vê)',
  SENT: 'Enviada — a aguardar resposta',
  ACCEPTED: 'Aceite pelo candidato',
  DECLINED: 'Recusada pelo candidato',
  EXPIRED: 'Expirada sem resposta',
  WITHDRAWN: 'Retirada pela empresa',
};

const PERIOD_LABEL = {
  HOUR: 'por hora',
  DAY: 'por dia',
  MONTH: 'por mês',
  YEAR: 'por ano',
};

export function formatOfferAmount(offer) {
  const value = Number(offer?.amountMinor) / 100;
  if (!Number.isFinite(value)) return 'Valor não indicado';
  const amount = value.toLocaleString('pt-PT', { maximumFractionDigits: 2 });
  const currency = offer.currency === 'EUR' ? '€' : 'Db';
  return `${amount} ${currency} ${PERIOD_LABEL[offer.period] || ''}`.trim();
}

function formatStartDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'A combinar';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** As condições da proposta, iguais para os dois lados. */
export function OfferSummary({ offer }) {
  return (
    <dl className={styles.snapshot}>
      <div>
        <dt>Estado</dt>
        <dd>{OFFER_STATUS_LABEL[offer.status] || offer.status}</dd>
      </div>
      <div>
        <dt>Remuneração</dt>
        <dd>{formatOfferAmount(offer)}</dd>
      </div>
      <div>
        <dt>Data de início</dt>
        <dd>{formatStartDate(offer.startDate)}</dd>
      </div>
      {offer.expiresAt ? (
        <div>
          <dt>Responder até</dt>
          <dd>{recruitmentDate(offer.expiresAt)}</dd>
        </div>
      ) : null}
      {offer.message ? (
        <div>
          <dt>Mensagem</dt>
          <dd className={styles.preview}>{offer.message}</dd>
        </div>
      ) : null}
    </dl>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Campos da proposta; com `offer`, vêm preenchidos (editar um rascunho). */
function offerFields(offer) {
  return [
    {
      name: 'amount',
      label: 'Salário proposto (valor inteiro)',
      type: 'number',
      min: 1,
      required: true,
      value: offer ? Math.round(Number(offer.amountMinor) / 100) : undefined,
    },
    {
      name: 'currency',
      label: 'Moeda',
      options: [
        // O valor guardado continua 'STN' (é o código das propostas já
        // existentes); o que o utilizador lê é o rótulo único do produto.
        ['STN', 'STD'],
        ['EUR', 'Euros (EUR)'],
      ],
      value: offer?.currency || 'STN',
    },
    {
      name: 'period',
      label: 'Periodicidade',
      options: [
        ['MONTH', 'Por mês'],
        ['YEAR', 'Por ano'],
        ['DAY', 'Por dia'],
        ['HOUR', 'Por hora'],
      ],
      value: offer?.period || 'MONTH',
    },
    {
      name: 'startDate',
      label: 'Data de início',
      type: 'date',
      required: true,
      value: offer?.startDate,
    },
    {
      name: 'expiresOn',
      label: 'O candidato pode responder até (inclusive)',
      type: 'date',
      required: true,
      min: todayIso(),
      value: offer?.expiresAt
        ? String(offer.expiresAt).slice(0, 10)
        : undefined,
    },
    {
      name: 'message',
      label: 'Mensagem ao candidato',
      type: 'textarea',
      maxLength: 4000,
      value: offer?.message,
    },
    {
      name: 'action',
      label: 'O que fazer agora',
      options: [
        ['send', 'Enviar já ao candidato'],
        ['save', 'Guardar como rascunho'],
      ],
    },
  ];
}

const offerBody = (offer) => (values) => ({
  action: values.action,
  ...(offer ? { offerId: offer.id, expectedVersion: offer.version } : {}),
  amountMinor: Math.round(Number(values.amount) * 100),
  currency: values.currency,
  period: values.period,
  startDate: values.startDate,
  // São Tomé está em UTC: o fim do dia escolhido, à hora local.
  expiresAt: `${values.expiresOn}T23:59:59Z`,
  message: String(values.message || '').trim(),
});

/**
 * Lado da empresa, no processo de uma candidatura.
 * @param {{base: string, status: string, version: number, request?: Function, onChange?: () => void}} props
 */
export function EmployerOfferPanel({
  base,
  status,
  version,
  request,
  onChange,
}) {
  const loader = useAction(request);
  const { run } = loader;
  const [offers, setOffers] = useState(null);
  const path = `${base}/offers`;
  const load = useCallback(
    () =>
      run(path, {}, (value) =>
        setOffers(Array.isArray(value?.offers) ? value.offers : []),
      ),
    [run, path],
  );
  useEffect(() => {
    void load();
  }, [load, version]);
  const changed = () => {
    void load();
    onChange?.();
  };

  if (!offers) return <ActionStatus action={loader} />;
  const active = offers.find((offer) => ACTIVE.includes(offer.status));
  const past = offers.filter((offer) => offer !== active);
  const canCreate = !active && ['SHORTLISTED', 'INTERVIEW'].includes(status);

  return (
    <section aria-label="Proposta de emprego">
      <h3>Proposta de emprego</h3>
      {active ? <OfferSummary offer={active} /> : null}
      {active?.status === 'ACCEPTED' ? (
        <p className={styles.notice}>
          O candidato aceitou. Confirme a contratação para concluir o processo.
        </p>
      ) : null}
      {active?.status === 'DRAFT' ? (
        <details>
          <summary>Rever e enviar o rascunho</summary>
          <ActionForm
            key={`offer-draft-${active.version}`}
            title="Rascunho da proposta"
            path={path}
            fields={offerFields(active)}
            buildBody={offerBody(active)}
            confirmText="Confirmo as condições desta proposta."
            request={request}
            onSuccess={changed}
            submit="Guardar proposta"
          />
        </details>
      ) : null}
      {active?.status === 'SENT' ? (
        <details>
          <summary>Retirar a proposta</summary>
          <ActionForm
            key={`offer-withdraw-${active.version}`}
            title="Retirar a proposta"
            path={path}
            buildBody={() => ({
              action: 'withdraw',
              offerId: active.id,
              expectedVersion: active.version,
            })}
            confirmText="Confirmo que retiro esta proposta. O candidato é avisado."
            request={request}
            onSuccess={changed}
            submit="Retirar proposta"
            secondary
          />
        </details>
      ) : null}
      {canCreate ? (
        <details>
          <summary>Preparar proposta</summary>
          <ActionForm
            title="Nova proposta"
            path={path}
            fields={offerFields(null)}
            buildBody={offerBody(null)}
            confirmText="Confirmo as condições desta proposta."
            request={request}
            onSuccess={changed}
            submit="Guardar proposta"
          />
        </details>
      ) : null}
      {!active && !canCreate && !past.length ? (
        <p className={styles.notice}>
          Pré-selecione ou entreviste o candidato para lhe fazer uma proposta.
        </p>
      ) : null}
      {past.length ? (
        <>
          <h4>Propostas anteriores</h4>
          <ul>
            {past.map((offer) => (
              <li key={offer.id}>
                {OFFER_STATUS_LABEL[offer.status] || offer.status} ·{' '}
                {formatOfferAmount(offer)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ActionStatus action={loader} />
    </section>
  );
}

/**
 * Lado do candidato: as propostas vêm na linha temporal (sem rascunhos).
 * @param {{applicationId: string, offers: Array<Record<string, any>>, onSuccess?: () => void, request?: Function}} props
 */
export function CandidateOfferPanel({
  applicationId,
  offers,
  onSuccess,
  request,
}) {
  if (!offers?.length) return null;
  const path = `/api/applications/${encodeURIComponent(applicationId)}/offers`;
  return (
    <section className={styles.panel} aria-label="Proposta de emprego">
      <h4>Proposta de emprego</h4>
      {offers.map((offer) => (
        <div key={offer.id}>
          <OfferSummary offer={offer} />
          {offer.status === 'SENT' ? (
            <div className={styles.row}>
              <ActionForm
                key={`accept-${offer.version}`}
                title="Aceitar a proposta"
                path={path}
                buildBody={() => ({
                  action: 'accept',
                  offerId: offer.id,
                  expectedVersion: offer.version,
                })}
                confirmText="Li as condições e aceito esta proposta."
                request={request}
                onSuccess={onSuccess}
                submit="Aceitar proposta"
              />
              <ActionForm
                key={`decline-${offer.version}`}
                title="Recusar a proposta"
                path={path}
                buildBody={() => ({
                  action: 'decline',
                  offerId: offer.id,
                  expectedVersion: offer.version,
                })}
                confirmText="Confirmo que recuso esta proposta."
                request={request}
                onSuccess={onSuccess}
                submit="Recusar proposta"
                secondary
              />
            </div>
          ) : null}
          {offer.status === 'ACCEPTED' ? (
            <p className={styles.notice}>
              Aceitou esta proposta. A empresa vai confirmar a sua contratação.
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
