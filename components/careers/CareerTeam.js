import Image from 'next/image';
import { FaFacebookF, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import styles from '../../styles/CareerTeam.module.css';

const NETWORKS = [
  { key: 'linkedin', label: 'LinkedIn', Icon: FaLinkedinIn },
  { key: 'facebook', label: 'Facebook', Icon: FaFacebookF },
  { key: 'instagram', label: 'Instagram', Icon: FaInstagram },
];

// Apenas os profissionais já publicados em /sobre-nos. Uma rede sem URL não
// mostra ícone, para nunca haver links mortos.
const TEAM = [
  {
    name: 'Edmir dos Santos',
    image: '/assets/equipa/edmir.webp',
    imagePosition: 'center 22%',
    // Links provisórios: substituir pelos perfis reais.
    social: {
      linkedin: 'https://linkedin.com',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
    },
  },
  {
    name: 'Joel Almeida',
    image: '/assets/equipa/joel.webp',
    imagePosition: 'center 22%',
    // Links provisórios: substituir pelos perfis reais.
    social: {
      linkedin: 'https://linkedin.com',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
    },
  },
  {
    name: 'Mauro Viegas',
    image: '/assets/equipa/mauro.webp',
    imagePosition: 'center 18%',
    // Links provisórios: substituir pelos perfis reais.
    social: {
      linkedin: 'https://linkedin.com',
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
    },
  },
];

export default function CareerTeam() {
  return (
    <div className={styles.teamGrid}>
      {TEAM.map((person, index) => {
        const links = NETWORKS.filter(({ key }) => person.social[key]);
        return (
          <article
            key={person.name}
            className={styles.teamCard}
            data-reveal
            style={{ '--delay': `${index * 120}ms` }}
          >
            <Image
              src={person.image}
              alt={person.name}
              fill
              sizes="(max-width: 48em) 100vw, 33vw"
              style={{ objectPosition: person.imagePosition }}
            />
            {links.length ? (
              <ul className={styles.teamSocial}>
                {links.map(({ key, label, Icon }) => (
                  <li key={key}>
                    <a
                      href={person.social[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${label} de ${person.name}`}
                    >
                      <Icon aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
