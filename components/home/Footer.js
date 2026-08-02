import Image from 'next/image';
import Link from 'next/link';
import { FiMail, FiPhone } from 'react-icons/fi';
import styles from '../../styles/Footer.module.css';

const candidateLinks = [
  { label: 'Encontrar vagas', href: '/vagas' },
  { label: 'Criar currículo', href: '/recursos/gerador-cv' },
  { label: 'Dicas de carreira', href: '/blog' },
];

const companyLinks = [
  { label: 'Publicar vagas', href: '/dashboard/empresa/vaga/criar-vaga' },
  { label: 'Procurar candidatos', href: '/#candidatos-verificados' },
  { label: 'Recursos', href: '/recursos' },
];

const companyInfoLinks = [
  { label: 'Sobre nós', href: '/sobre-nos' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contactos', href: '/contacto' },
  { label: 'Privacidade', href: '/politica-privacidade' },
];

function FooterLinkGroup({ title, links }) {
  return (
    <nav className={styles.linkGroup} aria-label={`Links de ${title}`}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <ul className={styles.links}>
        {links.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className={styles.link}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Footer() {
  return (
    <footer className={`${styles.footer} workbridgeFooter`}>
      <div className={styles.inner}>
        <div className={styles.signatureRail}>
          <span className={styles.signaturePlace}>
            São Tomé e Príncipe · Linha do Equador
          </span>
          <span className={styles.signatureMessage}>
            Talento local. Impacto global.
          </span>
        </div>

        <div className={styles.grid}>
          <div className={styles.brandBlock}>
            <Link href="/" className={styles.brand}>
              <span className={styles.brandMark}>
                <Image
                  src="/assets/Emprego STP Logo 2-wide.png"
                  alt="EmpregoSTP"
                  className={styles.brandLogo}
                  width={619}
                  height={169}
                  sizes="(max-width: 640px) 220px, 250px"
                />
              </span>
            </Link>
            <p className={styles.brandStatement}>
              Ligamos pessoas, empresas e oportunidades para fazer avançar o
              talento de São Tomé e Príncipe.
            </p>
          </div>

          <FooterLinkGroup title="Candidatos" links={candidateLinks} />
          <FooterLinkGroup title="Empresas" links={companyLinks} />
          <FooterLinkGroup title="Plataforma" links={companyInfoLinks} />

          <nav className={styles.contactGroup} aria-label="Contactos">
            <h4 className={styles.sectionTitle}>Contacto</h4>
            <div className={styles.contactList}>
              <a href="tel:+2399869673" className={styles.contactItem}>
                <span className={styles.contactIcon}>
                  <FiPhone aria-hidden="true" />
                </span>
                <span>+239 986 9673</span>
              </a>
              <a
                href="mailto:suporte@empregos.st"
                className={styles.contactItem}
              >
                <span className={styles.contactIcon}>
                  <FiMail aria-hidden="true" />
                </span>
                <span>suporte@empregos.st</span>
              </a>
            </div>
          </nav>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          <div className={styles.copyright}>
            © {new Date().getFullYear()} EmpregosSTP. Todos os direitos
            reservados.
          </div>
          <div className={styles.bottomLinks}>
            <Link href="/politica-privacidade" className={styles.bottomLink}>
              Privacidade
            </Link>
            <Link href="/termos" className={styles.bottomLink}>
              Termos
            </Link>
            <Link href="/cookies" className={styles.bottomLink}>
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
