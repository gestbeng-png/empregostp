import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { MdVerified } from 'react-icons/md';

import { TrustSealIcon } from '../VerificationBadge';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/HomePage.module.css';
import tileStyles from '../../styles/HomeTalentTile.module.css';

/**
 * @typedef {Object} VerifiedCandidate
 * @property {string} id
 * @property {string} fullName
 * @property {string} headline
 * @property {string} experienceLabel
 * @property {string} initials
 * @property {string} [photoUrl]
 * @property {'public' | 'recruiters'} profileVisibility
 */

const CANDIDATES_PER_PAGE = 3;

/**
 * @param {{
 *   candidate: VerifiedCandidate,
 *   imageClassName?: string,
 *   fallbackClassName?: string,
 * }} props
 */
function CandidateAvatar({
  candidate,
  imageClassName = styles.homeCandidateAvatarImage,
  fallbackClassName = styles.homeCandidateAvatar,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(candidate.photoUrl) && !imageFailed;

  if (showImage) {
    return (
      <Image
        src={candidate.photoUrl}
        alt=""
        className={imageClassName}
        width={124}
        height={124}
        sizes="(max-width: 720px) 80px, 124px"
        unoptimized
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className={fallbackClassName} aria-hidden="true">
      {candidate.initials}
    </div>
  );
}

// Quem já tem sessão vai direto ao perfil: mandá-lo para /login fazia parecer
// que a sessão se tinha perdido. O servidor do perfil decide o acesso.
function getCandidateHref(candidate, signedIn = false) {
  const profileHref = `/candidatos/${candidate.id}`;
  return signedIn || candidate.profileVisibility === 'public'
    ? profileHref
    : `/login?redirect=${encodeURIComponent(profileHref)}`;
}

function getCandidateLinkLabel(candidate, signedIn = false) {
  return signedIn || candidate.profileVisibility === 'public'
    ? `Ver perfil de ${candidate.fullName}`
    : `Iniciar sessão de empresa para ver o perfil de ${candidate.fullName}`;
}

/**
 * Cartão da home: foto, nome com selo, título, "Verificado" e "Ver perfil".
 * Exportado para a /verificados, que mostra os mesmos cartões em grelha.
 * @param {{ candidate: VerifiedCandidate }} props
 */
export function HomeTalentTile({ candidate }) {
  const signedIn = Boolean(useAuth()?.user);
  return (
    <Link
      href={getCandidateHref(candidate, signedIn)}
      className={tileStyles.tile}
      aria-label={getCandidateLinkLabel(candidate, signedIn)}
    >
      <CandidateAvatar
        candidate={candidate}
        imageClassName={tileStyles.photo}
        fallbackClassName={tileStyles.photoFallback}
      />
      <div className={tileStyles.body}>
        <div className={tileStyles.nameRow}>
          <h3 className={tileStyles.name}>{candidate.fullName}</h3>
          <TrustSealIcon className={tileStyles.seal} />
        </div>
        {candidate.headline ? (
          <p className={tileStyles.role}>{candidate.headline}</p>
        ) : null}
        <span className={tileStyles.status}>Verificado</span>
      </div>
      <span className={tileStyles.cta} aria-hidden="true">
        Ver perfil
      </span>
    </Link>
  );
}

/** @param {{ candidate: VerifiedCandidate }} props */
function CandidateCard({ candidate }) {
  const signedIn = Boolean(useAuth()?.user);
  const content = (
    <>
      <CandidateAvatar candidate={candidate} />
      <div className={styles.homeCandidateInfo}>
        <p className={styles.homeCandidateHeadline}>{candidate.headline}</p>
        <h3 className={styles.homeCandidateName}>{candidate.fullName}</h3>
        <p className={styles.homeCandidateExperience}>
          {candidate.experienceLabel}
        </p>
        <span className={styles.homeCandidateStatus}>
          Ver mais
          <FiArrowRight
            className={styles.homeCandidateCardArrow}
            aria-hidden="true"
          />
        </span>
      </div>
      <span
        className={styles.homeCandidateVerified}
        aria-label="Perfil verificado"
      >
        <MdVerified aria-hidden="true" />
      </span>
    </>
  );

  return (
    <Link
      href={getCandidateHref(candidate, signedIn)}
      className={styles.homeCandidateCard}
      aria-label={getCandidateLinkLabel(candidate, signedIn)}
    >
      {content}
    </Link>
  );
}

/**
 * @param {{ candidates?: VerifiedCandidate[], variante?: 'home' | 'larga' }} props
 *
 * `variante="larga"` serve as páginas onde o carrossel ocupa a largura toda
 * (a /empresas): três cartões lado a lado em vez da escada estreita da home.
 */
export default function VerifiedCandidatesCarousel({
  candidates = [],
  variante = 'home',
}) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const candidatePages = useMemo(() => {
    const pages = [];
    for (
      let index = 0;
      index < candidates.length;
      index += CANDIDATES_PER_PAGE
    ) {
      pages.push(candidates.slice(index, index + CANDIDATES_PER_PAGE));
    }
    return pages;
  }, [candidates]);

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(candidatePages.length - 1, 0)),
    );
  }, [candidatePages.length]);

  const scrollToPage = (nextIndex) => {
    const track = trackRef.current;
    if (!track || candidatePages.length < 2) return;

    const slides = Array.from(track.querySelectorAll('[data-candidate-slide]'));
    const normalizedIndex =
      (nextIndex + candidatePages.length) % candidatePages.length;
    const slide = slides[normalizedIndex];
    if (!slide) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    track.scrollTo({
      left: slide.offsetLeft - track.offsetLeft,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    setActiveIndex(normalizedIndex);
  };

  const handleTrackScroll = (event) => {
    const track = event.currentTarget;
    const slides = Array.from(track.querySelectorAll('[data-candidate-slide]'));
    if (!slides.length) return;

    const closestIndex = slides.reduce((bestIndex, slide, index) => {
      const bestDistance = Math.abs(
        slides[bestIndex].offsetLeft - track.offsetLeft - track.scrollLeft,
      );
      const currentDistance = Math.abs(
        slide.offsetLeft - track.offsetLeft - track.scrollLeft,
      );
      return currentDistance < bestDistance ? index : bestIndex;
    }, 0);

    setActiveIndex(closestIndex);
  };

  if (!candidates.length) {
    return (
      <div className={styles.candidatesEmpty} role="status">
        <span className={styles.candidatesEmptyEyebrow}>
          Perfis verificados
        </span>
        <h3>O próximo perfil em destaque pode ser o seu</h3>
        <p>
          Dê mais força à sua experiência profissional. Verifique o seu perfil,
          aumente a confiança das empresas e esteja mais perto da próxima
          oportunidade.
        </p>
        <Link
          href="/candidatos#planos"
          className={styles.candidatesEmptyButton}
        >
          Seja verificado
          <FiArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`${styles.candidateCarousel} ${
        variante === 'larga' ? styles.carouselWide : ''
      }`}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Perfis verificados"
    >
      <p className={styles.srOnly}>
        {candidates.length}{' '}
        {candidates.length === 1
          ? 'talento disponível'
          : 'talentos disponíveis'}
      </p>

      <div
        ref={trackRef}
        className={styles.candidateCarouselTrack}
        onScroll={handleTrackScroll}
      >
        {candidatePages.map((candidatePage, pageIndex) => (
          <div
            key={candidatePage.map((candidate) => candidate.id).join('-')}
            className={styles.candidateCarouselPage}
            data-candidate-slide
            role="group"
            aria-roledescription="página"
            aria-label={`Página ${pageIndex + 1} de ${candidatePages.length}`}
          >
            <ul className={`${styles.candidatesList} ${styles.candidateStack}`}>
              {candidatePage.map((candidate) =>
                variante === 'larga' ? (
                  <li
                    key={candidate.id}
                    className={styles.homeCandidateListItem}
                  >
                    <CandidateCard candidate={candidate} />
                  </li>
                ) : (
                  <li key={candidate.id} className={tileStyles.item}>
                    <HomeTalentTile candidate={candidate} />
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      {candidatePages.length > 1 ? (
        <div
          className={styles.candidateCarouselControls}
          aria-label="Navegação dos perfis"
        >
          <button
            type="button"
            className={styles.candidateCarouselButton}
            onClick={() => scrollToPage(activeIndex - 1)}
            aria-label="Ver perfis anteriores"
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          <span className={styles.candidateCarouselPosition} aria-live="polite">
            {activeIndex + 1} / {candidatePages.length}
          </span>
          <button
            type="button"
            className={styles.candidateCarouselButton}
            onClick={() => scrollToPage(activeIndex + 1)}
            aria-label="Ver perfis seguintes"
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
