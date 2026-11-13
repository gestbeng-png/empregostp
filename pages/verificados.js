import { useMemo, useState } from 'react';
import Head from 'next/head';
import {
  FiChevronDown,
  FiSearch,
  FiShield,
  FiSliders,
  FiX,
} from 'react-icons/fi';
import PublicPageShell from '../components/PublicPageShell';
import VerifiedCandidatesCarousel, {
  HomeTalentTile,
} from '../components/home/VerifiedCandidatesCarousel';
import { admin } from '../lib/firebaseAdmin';
import { fetchSpotlightCandidates } from '../lib/spotlightCandidates';
import { logServerError } from '../lib/serverLog';
import {
  filterVerifiedTalents,
  getTalentFilterOptions,
} from '../lib/verifiedTalentFilters';
import styles from '../styles/VerifiedCandidatesPage.module.css';

/** @param {{ candidates?: import('../components/home/VerifiedCandidatesCarousel').VerifiedCandidate[] }} props */
export default function VerifiedCandidatesPage({ candidates = [] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [experience, setExperience] = useState('');
  const options = useMemo(
    () => getTalentFilterOptions(candidates),
    [candidates],
  );
  const filteredCandidates = useMemo(
    () => filterVerifiedTalents(candidates, { query, category, experience }),
    [candidates, query, category, experience],
  );
  const hasFilters = Boolean(query.trim() || category || experience);
  const clearFilters = () => {
    setQuery('');
    setCategory('');
    setExperience('');
  };
  return (
    <PublicPageShell headerVariant="light">
      <Head>
        <title>Perfis verificados | EmpregoSTP</title>
        <meta
          name="description"
          content="Conheça os profissionais verificados disponíveis no EmpregoSTP."
        />
      </Head>
      <div className={styles.page}>
        <section className={styles.intro} aria-labelledby="verified-title">
          <span className={styles.eyebrow}>
            <FiShield aria-hidden="true" /> Perfis verificados
          </span>
          <h1 id="verified-title">Quem já está verificado no EmpregoSTP</h1>
          <p>
            Profissionais com percurso confirmado pela nossa equipa. Verifique o
            seu perfil e apareça também aqui, à frente de quem contrata.
          </p>
        </section>
        <section className={styles.profiles} aria-labelledby="profiles-title">
          <h2 id="profiles-title">Perfis verificados</h2>
          <form
            className={styles.filters}
            role="search"
            aria-label="Filtrar talentos"
            onSubmit={(event) => event.preventDefault()}
          >
            <span className={styles.filterHeading}>
              <FiSliders aria-hidden="true" /> Filtrar
            </span>
            <label className={styles.filterPill}>
              <span className={styles.srOnly}>Categoria</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-controls="verified-talent-results"
              >
                <option value="">Categoria</option>
                {options.categories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden="true" />
            </label>
            <label className={styles.filterPill}>
              <span className={styles.srOnly}>Experiência</span>
              <select
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                aria-controls="verified-talent-results"
              >
                <option value="">Experiência</option>
                {options.experience.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({option.count})
                  </option>
                ))}
              </select>
              <FiChevronDown aria-hidden="true" />
            </label>
            <label className={styles.searchPill}>
              <FiSearch aria-hidden="true" />
              <span className={styles.srOnly}>Pesquisar talentos</span>
              <input
                type="search"
                placeholder="Nome ou profissão"
                maxLength={120}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-controls="verified-talent-results"
              />
            </label>
          </form>
          <div className={styles.resultsMeta}>
            <p role="status" aria-live="polite" aria-atomic="true">
              <strong>{filteredCandidates.length}</strong>{' '}
              {filteredCandidates.length === 1
                ? 'talento encontrado'
                : 'talentos encontrados'}
              {hasFilters ? ` de ${candidates.length}` : ''}
            </p>
            {hasFilters ? (
              <button
                type="button"
                className={styles.clearFilters}
                onClick={clearFilters}
              >
                <FiX aria-hidden="true" /> Limpar filtros
              </button>
            ) : null}
          </div>
          <div id="verified-talent-results">
            {filteredCandidates.length ? (
              // Os mesmos cartões da home, sobre o mesmo painel azul (a moldura
              // de vidro só se vê com cor por trás), mas todos à vista.
              <div className={styles.panel}>
                <ul className={styles.grid}>
                  {filteredCandidates.map((candidate) => (
                    <li key={candidate.id} className={styles.gridItem}>
                      <HomeTalentTile candidate={candidate} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : hasFilters ? (
              <div className={styles.noResults}>
                <FiSearch aria-hidden="true" />
                <h3>Nenhum talento corresponde aos filtros</h3>
                <p>
                  Experimente outra categoria ou limpe os filtros para ver todos
                  os perfis.
                </p>
                <button type="button" onClick={clearFilters}>
                  Ver todos os talentos
                </button>
              </div>
            ) : (
              <VerifiedCandidatesCarousel candidates={candidates} />
            )}
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}

export async function getServerSideProps() {
  try {
    const candidates = await fetchSpotlightCandidates(admin);
    return { props: { candidates: JSON.parse(JSON.stringify(candidates)) } };
  } catch (error) {
    logServerError('verificados.carregar_perfis_falhou', error);
    return { props: { candidates: [] } };
  }
}
