import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiArrowLeft,
  FiArrowRight,
  FiBarChart2,
  FiRepeat,
  FiShield,
  FiWifi,
} from 'react-icons/fi';
import styles from '../../styles/ProductAdsCarousel.module.css';

// Ícones das condições, pela ordem em que a empresa as escreve.
const FEATURE_ICONS = [
  { Icon: FiShield, tone: 'brand' },
  { Icon: FiWifi, tone: 'success' },
  { Icon: FiRepeat, tone: 'warning' },
];

function AdCta({ href, label }) {
  const content = (
    <>
      <span>{label}</span>
      <FiArrowRight aria-hidden="true" />
    </>
  );
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={styles.cta}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={styles.cta}>
      {content}
    </Link>
  );
}

/**
 * @param {{ ads?: Array<{ id: string, title: string, companyName: string, description: string, imageUrl: string, href: string, companyLogoUrl?: string, badges?: string[], features?: string[], priceLabel?: string, price?: string, priceSuffix?: string }>, previewCreativeSrc?: string }} props
 */
export default function ProductAdsCarousel({
  ads = [],
  previewCreativeSrc = '',
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Imagens externas podem falhar (hotlink bloqueado, link partido); nesse
  // caso mostra-se um painel da marca em vez de um espaço vazio.
  const [failedImages, setFailedImages] = useState(() => new Set());
  const isPreview = ads.length === 0 && Boolean(previewCreativeSrc);
  const slides = isPreview
    ? [
        {
          id: 'creative-preview',
          companyName: 'Pré-visualização',
          title: 'Peça ainda não publicada',
          description:
            'Esta imagem só é visível no ambiente de pré-visualização.',
          imageUrl: previewCreativeSrc,
          imageAlt: 'Peça publicitária em pré-visualização',
          badges: ['Pré-visualização', 'Não publicado'],
        },
      ]
    : ads;
  const isEmpty = slides.length === 0;
  const hasMultiple = slides.length > 1;

  useEffect(() => {
    if (!hasMultiple || paused) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [hasMultiple, paused, slides.length]);

  if (isEmpty) {
    return (
      <div
        className={styles.emptyState}
        role="region"
        aria-label="Anúncios de empresas"
      >
        <span className={styles.emptyKicker}>Espaço para empresas</span>
        <h3>Ainda não há anúncios publicados</h3>
        <p>
          Quando uma empresa publicar um anúncio aprovado, ele aparecerá aqui.
        </p>
      </div>
    );
  }

  const activeAd = slides[activeIndex] || slides[0];
  const previous = () =>
    setActiveIndex((index) => (index - 1 + slides.length) % slides.length);
  const next = () => setActiveIndex((index) => (index + 1) % slides.length);

  const noun = 'anúncio';
  const badges = (activeAd.badges || []).filter(Boolean).slice(0, 2);
  const features = (activeAd.features || []).filter(Boolean).slice(0, 3);
  const showPrice = Boolean(activeAd.price);
  const showFooter = showPrice || Boolean(activeAd.href);
  const imageFailed = failedImages.has(activeAd.id) || !activeAd.imageUrl;
  const markImageFailed = () =>
    setFailedImages((current) => new Set(current).add(activeAd.id));

  return (
    <div
      className={styles.carousel}
      role="region"
      aria-label="Anúncios de produtos de empresas"
      aria-roledescription="carrossel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
    >
      <article className={styles.card} key={activeAd.id}>
        <div className={styles.mediaFrame}>
          <span className={styles.adSeal}>Anúncio</span>
          <div className={styles.media}>
            {imageFailed ? (
              <div className={styles.mediaFallback} aria-hidden="true">
                <span className={styles.mediaFallbackTitle}>
                  {activeAd.title}
                </span>
              </div>
            ) : (
              <>
                {/* A foto aparece inteira; a mesma imagem desfocada preenche o resto. */}
                <Image
                  src={activeAd.imageUrl}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 1023px) 100vw, 30vw"
                  className={styles.imageBackdrop}
                  unoptimized={/^https?:\/\//i.test(activeAd.imageUrl)}
                />
                <Image
                  src={activeAd.imageUrl}
                  alt={activeAd.imageAlt || activeAd.title}
                  fill
                  sizes="(max-width: 1023px) 100vw, 30vw"
                  className={styles.image}
                  unoptimized={/^https?:\/\//i.test(activeAd.imageUrl)}
                  onError={markImageFailed}
                />
              </>
            )}
            {badges.length ? (
              <div className={styles.badges}>
                {badges[0] ? (
                  <span className={styles.badgeDark}>
                    <FiBarChart2 aria-hidden="true" />
                    {badges[0]}
                  </span>
                ) : null}
                {badges[1] ? (
                  <span className={styles.badgeAccent}>{badges[1]}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.body} aria-live={paused ? 'polite' : 'off'}>
          <div className={styles.company}>
            {/* Sem logótipo mostra-se só o nome, sem inicial a imitar um. */}
            {activeAd.companyLogoUrl ? (
              <span className={styles.logo}>
                <Image
                  src={activeAd.companyLogoUrl}
                  alt=""
                  fill
                  sizes="2rem"
                  className={styles.logoImage}
                  unoptimized={/^https?:\/\//i.test(activeAd.companyLogoUrl)}
                />
              </span>
            ) : null}
            <span className={styles.companyName}>{activeAd.companyName}</span>
          </div>
          <h3 className={styles.title}>{activeAd.title}</h3>
          {activeAd.description ? (
            <p className={styles.description}>{activeAd.description}</p>
          ) : null}
          {features.length ? (
            <ul className={styles.features}>
              {features.map((feature, index) => {
                const { Icon, tone } = FEATURE_ICONS[index];
                return (
                  <li key={`${index}-${feature}`} className={styles.feature}>
                    <Icon aria-hidden="true" data-tone={tone} />
                    {feature}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {showFooter ? (
            <div className={styles.footer}>
              {showPrice ? (
                <div className={styles.price}>
                  {activeAd.priceLabel ? (
                    <span className={styles.priceLabel}>
                      {activeAd.priceLabel}
                    </span>
                  ) : null}
                  <span className={styles.priceValue}>
                    {activeAd.price}
                    {activeAd.priceSuffix ? (
                      <small>{activeAd.priceSuffix}</small>
                    ) : null}
                  </span>
                </div>
              ) : null}
              {activeAd.href ? (
                <AdCta href={activeAd.href} label="Saiba mais" />
              ) : null}
            </div>
          ) : null}
        </div>
      </article>

      {hasMultiple ? (
        <div className={styles.toolbar}>
          <div
            className={styles.dots}
            role="group"
            aria-label={`Escolher ${noun}`}
          >
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={index === activeIndex ? styles.dotActive : ''}
                onClick={() => setActiveIndex(index)}
                aria-label={`Ir para ${noun} ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>
          <div className={styles.controls}>
            <span
              className={styles.count}
              aria-label={`Anúncio ${activeIndex + 1} de ${slides.length}`}
            >
              {String(activeIndex + 1).padStart(2, '0')}
              <span aria-hidden="true"> / </span>
              {String(slides.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={previous}
              aria-label="Anúncio anterior"
            >
              <FiArrowLeft aria-hidden="true" />
            </button>
            <button type="button" onClick={next} aria-label="Próximo anúncio">
              <FiArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
