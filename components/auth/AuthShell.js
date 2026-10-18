import Image from 'next/image';
import Link from 'next/link';
import styles from '../../styles/AuthPage.module.css';

// Autenticação: só o logótipo e o formulário, com a linguagem visual atual
// (cartão arredondado, botões em pílula, lima da marca).
export default function AuthShell({ wide = false, children }) {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div
          className={`${styles.formPanelInner} ${
            wide ? styles.formPanelInnerWide : ''
          }`}
        >
          <Link
            href="/"
            className={styles.brandLink}
            aria-label="Voltar à página inicial"
          >
            <Image
              src="/assets/Logo header.png"
              alt="EmpregoSTP"
              width={1896}
              height={511}
              priority
            />
          </Link>

          {children}
        </div>
      </main>
    </div>
  );
}
