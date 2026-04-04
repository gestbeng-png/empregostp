import Link from 'next/link';
import { FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaLinkedin, FaTwitter } from 'react-icons/fa';
import styles from '../../styles/Footer.module.css';

const candidateLinks = [
  { label: 'Encontrar Vagas', href: '/vagas' },
  { label: 'Criar Currículo', href: '/recursos/gerador-cv' },
  { label: 'Alertas de Vagas', href: '/dashboard/candidato' },
  { label: 'Dicas de Carreira', href: '/blog' },
];

const companyLinks = [
  { label: 'Publicar Vagas', href: '/dashboard/empresa/vaga/criar-vaga' },
  { label: 'Buscar Candidatos', href: '/candidatos' },
  { label: 'Planos e Preços', href: '/premium/empresa' },
  { label: 'Recursos', href: '/recursos' },
];

const companyInfoLinks = [
  { label: 'Sobre Nós', href: '/sobre-nos' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contato', href: '/sobre-nos' },
  { label: 'Privacidade', href: '/politica-privacidade' },
];

const socialLinks = [
  { href: '#', label: 'Facebook', Icon: FaFacebook },
  { href: '#', label: 'Instagram', Icon: FaInstagram },
  { href: '#', label: 'LinkedIn', Icon: FaLinkedin },
  { href: '#', label: 'Twitter', Icon: FaTwitter },
];

function FooterLinkGroup({ title, links }) {
  return (
    <div>
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
    </div>
  );
}

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brandBlock}>
            <h3 className={styles.brandTitle}>EmpregosSTP</h3>
            <p className={styles.brandDescription}>
              Conectando talentos às melhores oportunidades em São Tomé e Príncipe.
            </p>

            <div className={styles.contactList}>
              <a href="tel:+2399869673" className={styles.contactItem}>
                <span className={styles.contactIcon}>
                  <FaPhone />
                </span>
                <span>+239 986 9673</span>
              </a>
              <a href="mailto:suporte@empregos.st" className={styles.contactItem}>
                <span className={styles.contactIcon}>
                  <FaEnvelope />
                </span>
                <span>suporte@empregos.st</span>
              </a>
            </div>

            <div className={styles.socialList}>
              {socialLinks.map(({ href, label, Icon }) => (
                <a key={label} href={href} className={styles.socialLink} aria-label={label}>
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          <FooterLinkGroup title="Para Você" links={candidateLinks} />
          <FooterLinkGroup title="Para Empresas" links={companyLinks} />
          <FooterLinkGroup title="Empresa" links={companyInfoLinks} />
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomInner}>
          <div className={styles.copyright}>
            © {new Date().getFullYear()} EmpregosSTP. Todos os direitos reservados.
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
