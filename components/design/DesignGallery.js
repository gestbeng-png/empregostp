import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import VerificationBadge from '../VerificationBadge';
import AutoSaveStatus from '../forms/AutoSaveStatus';
import CompactJobCard from '../home/CompactJobCard';
import styles from '../../styles/DesignGallery.module.css';

const UpgradeModal = dynamic(() => import('../UpgradeModal'));
const TOKENS = [
  ['Estrutura', '--dash-navy'],
  ['Ação', '--dash-blue'],
  ['Informação', '--dash-sky'],
  ['Destaque', '--dash-lime'],
  ['Superfície', '--dash-surface'],
  ['Texto', '--dash-ink'],
];
const BADGES = [
  ['active', 'Ativa'],
  ['closed', 'Encerrada'],
  ['pending', 'Pendente'],
  ['success', 'Concluída'],
  ['warn', 'Atenção'],
];
const SAVE_STATES = [
  'idle',
  'restoring',
  'restored',
  'saving',
  'saved',
  'offline',
  'error',
];
const SECTIONS = [
  'tokens',
  'buttons',
  'forms',
  'states',
  'cards',
  'navigation',
  'modal',
];

export default function DesignGallery() {
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState('Visão geral');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState('');
  const closeModal = useCallback(() => setModalOpen(false), []);
  const onTabKey = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'Visão geral'
        : event.key === 'End'
          ? 'Detalhes'
          : tab === 'Detalhes'
            ? 'Visão geral'
            : 'Detalhes';
    setTab(next);
    document
      .getElementById(`tab-${next === 'Detalhes' ? 'details' : 'overview'}`)
      ?.focus();
  };
  return (
    <div className={styles.root} data-design-gallery>
      <p>
        Ambiente de demonstração. Os exemplos usam dados fictícios e não
        publicam vagas, anúncios, pagamentos ou mensagens.
      </p>
      <nav aria-label="Secções da galeria" className={styles.row}>
        {SECTIONS.map((section) => (
          <a key={section} className="btn btn-ghost" href={`#${section}`}>
            {
              {
                tokens: 'Tokens',
                buttons: 'Botões',
                forms: 'Formulários',
                states: 'Estados',
                cards: 'Cards',
                navigation: 'Navegação',
                modal: 'Modal',
              }[section]
            }
          </a>
        ))}
      </nav>

      <section id="tokens" className="panel" aria-labelledby="tokens-title">
        <h2 id="tokens-title" className="panel-title">
          Tokens e tema existente
        </h2>
        <p>
          Use a alternância de tema na barra superior para verificar o modo
          escuro já disponível no dashboard.
        </p>
        <div className={styles.row}>
          {TOKENS.map(([label, token]) => (
            <figure key={token} className={styles.swatch}>
              <span
                className={styles.color}
                style={{ background: `var(${token})` }}
                aria-hidden="true"
              />
              <figcaption>
                {label}
                <br />
                <code>{token}</code>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="buttons" className="panel" aria-labelledby="buttons-title">
        <h2 id="buttons-title" className="panel-title">
          Botões · normal, hover, foco, desativado
        </h2>
        <div className={styles.row}>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setFeedback('Ação de demonstração concluída.')}
          >
            Guardar exemplo
          </button>
          <button className="btn btn-lime" type="button">
            Destaque
          </button>
          <button className="btn btn-ghost" type="button">
            Secundário
          </button>
          <button className="btn btn-danger-ghost" type="button">
            Remover exemplo
          </button>
          <button className="btn btn-primary" type="button" disabled>
            Indisponível
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled
            aria-busy="true"
          >
            A guardar…
          </button>
        </div>
        <p role="status" aria-live="polite">
          {feedback ||
            'Use Tab para inspecionar o foco. Nenhuma ação guarda dados.'}
        </p>
      </section>

      <section id="forms" className="panel" aria-labelledby="forms-title">
        <h2 id="forms-title" className="panel-title">
          Formulários · preenchido, vazio, erro, desativado
        </h2>
        <div className={styles.fields}>
          <label className="form-field">
            <span className="form-label">Nome do exemplo</span>
            <input
              className="form-input"
              defaultValue="Empresa de demonstração"
            />
          </label>
          <label className="form-field">
            <span className="form-label">Pesquisa vazia</span>
            <input className="form-input" placeholder="Pesquisar" />
          </label>
          <label className="form-field">
            <span className="form-label">Campo desativado</span>
            <input
              className="form-input"
              disabled
              value="Apenas demonstração"
              readOnly
            />
          </label>
          <label className="form-field">
            <span className="form-label">Email com erro</span>
            <input
              className="form-input"
              type="email"
              defaultValue="email-inválido"
              aria-invalid="true"
              aria-describedby="email-error"
            />
            <span id="email-error" className={styles.error}>
              Introduza um email válido.
            </span>
          </label>
          <label className="form-field">
            <span className="form-label">Localização</span>
            <select className="form-select" defaultValue="Água Grande">
              <option>Água Grande</option>
              <option>Príncipe</option>
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Descrição</span>
            <textarea
              className="form-textarea"
              defaultValue="Texto de exemplo. Não é publicado."
            />
          </label>
          <label className="form-field">
            <span className="form-label">Ficheiro de demonstração</span>
            <input
              className="form-input"
              type="file"
              accept=".pdf,.jpg,.png"
              aria-describedby="file-help"
            />
            <span id="file-help">
              Seleção local; não é enviado para o servidor.
            </span>
          </label>
        </div>
        <fieldset className={styles.fieldset}>
          <legend>Preferências de demonstração</legend>
          <label>
            <input type="checkbox" defaultChecked /> Receber atualizações de
            exemplo
          </label>
          <label>
            <input type="checkbox" disabled /> Opção indisponível
          </label>
          <label>
            <input type="checkbox" role="switch" /> Alternância nativa
          </label>
        </fieldset>
        <fieldset className={styles.fieldset}>
          <legend>Regime de demonstração</legend>
          <label>
            <input type="radio" name="example-regime" defaultChecked />{' '}
            Presencial
          </label>
          <label>
            <input type="radio" name="example-regime" /> Remoto
          </label>
        </fieldset>
      </section>

      <section id="states" className="panel" aria-labelledby="states-title">
        <h2 id="states-title" className="panel-title">
          Feedback, badges e carregamento
        </h2>
        <div className={styles.row}>
          {BADGES.map(([status, label]) => (
            <span
              key={status}
              className={`badge badge-${status}${status === 'warn' ? ` ${styles.warning}` : ''}`}
            >
              {label}
            </span>
          ))}
          <VerificationBadge verified size="sm" />
          <VerificationBadge verified variant="text" />
        </div>
        <div className={styles.row}>
          {SAVE_STATES.map((status) => (
            <AutoSaveStatus key={status} status={status} />
          ))}
        </div>
        <div className={styles.fields}>
          <div
            className="loading-state"
            role="status"
            aria-label="A carregar exemplo"
          >
            <span className="spinner" aria-hidden="true" />
            <span>A carregar…</span>
          </div>
          <div
            className={styles.skeletons}
            role="status"
            aria-label="Conteúdo de exemplo a carregar"
          >
            <div className={`skeleton ${styles.skeletonLine}`} />
            <div className={`skeleton ${styles.skeletonLine}`} />
            <div className={`skeleton ${styles.skeletonLine}`} />
          </div>
          <div className="empty-state">
            <h3>Ainda não há exemplos guardados</h3>
            <p>Crie um exemplo para explorar o estado preenchido.</p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() =>
                setFeedback('Exemplo criado apenas nesta galeria.')
              }
            >
              Criar exemplo
            </button>
          </div>
          <div className="empty-state">
            <h3>Não foi possível carregar o exemplo</h3>
            <p>Verifique a ligação e tente novamente.</p>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setFeedback('Nova tentativa simulada.')}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </section>

      <section id="cards" className="panel" aria-labelledby="cards-title">
        <h2 id="cards-title" className="panel-title">
          Card de vaga existente · aberto e encerrado
        </h2>
        <div className={styles.fields}>
          {['active', 'closed'].map((status) => (
            <CompactJobCard
              key={status}
              href="/_design#cards"
              title="Assistente administrativo · exemplo"
              companyName="Empresa fictícia"
              status={status}
              badgeLabel="Tempo inteiro"
              salary="A combinar"
              metaItems={[{ icon: 'location', text: 'Água Grande' }]}
              actionLabel="Ver exemplo"
              actionHref="/_design#cards"
              publishedLabel="Data de exemplo"
              closingLabel="Prazo de exemplo"
            />
          ))}
        </div>
      </section>

      <section
        id="navigation"
        className="panel"
        aria-labelledby="navigation-title"
      >
        <h2 id="navigation-title" className="panel-title">
          Navegação nativa e padrões existentes
        </h2>
        <nav aria-label="Breadcrumb de exemplo">
          <ol className={styles.row}>
            <li>
              <Link href="/_design">Galeria</Link>
            </li>
            <li aria-current="page">Navegação</li>
          </ol>
        </nav>
        <div
          className={styles.row}
          role="tablist"
          aria-label="Separadores de exemplo"
        >
          {['Visão geral', 'Detalhes'].map((label) => (
            <button
              key={label}
              id={`tab-${label === 'Detalhes' ? 'details' : 'overview'}`}
              role="tab"
              aria-selected={tab === label}
              aria-controls="example-tab-panel"
              tabIndex={tab === label ? 0 : -1}
              onKeyDown={onTabKey}
              className={`btn ${tab === label ? 'btn-primary' : 'btn-ghost'}`}
              type="button"
              onClick={() => setTab(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <p
          id="example-tab-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab === 'Detalhes' ? 'details' : 'overview'}`}
        >
          {tab}: conteúdo fictício.
        </p>
        <nav aria-label="Paginação de exemplo" className={styles.row}>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page === 1}
            onClick={() => setPage(1)}
          >
            Anterior
          </button>
          <span aria-live="polite">Página {page} de 2</span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={page === 2}
            onClick={() => setPage(2)}
          >
            Seguinte
          </button>
        </nav>
        <details>
          <summary>Dropdown nativo de demonstração</summary>
          <p>Conteúdo local, sem alterações à conta.</p>
        </details>
        <p>
          <span title="Informação adicional de demonstração" tabIndex={0}>
            Tooltip nativo: informação adicional
          </span>
        </p>
        <div className={styles.table}>
          <table className="data-table">
            <caption>Tabela de exemplo</caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Exemplo A</th>
                <td>
                  <span className="badge badge-active">Ativo</span>
                </td>
              </tr>
              <tr>
                <th scope="row">Exemplo B</th>
                <td>
                  <span className="badge badge-pending">Pendente</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="modal" className="panel" aria-labelledby="modal-title">
        <h2 id="modal-title" className="panel-title">
          Modal existente
        </h2>
        <p>
          Carregado apenas ao abrir. Use Escape para fechar e verificar o
          regresso do foco.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setModalOpen(true)}
        >
          Abrir modal de exemplo
        </button>
      </section>
      {modalOpen ? (
        <UpgradeModal
          isOpen
          onClose={closeModal}
          message="Demonstração do modal existente. Nenhum pagamento ou alteração de plano é realizado."
          upgradeUrl="/_design#modal"
        />
      ) : null}
    </div>
  );
}
