import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  FiAlertCircle,
  FiBriefcase,
  FiCheck,
  FiCheckCircle,
  FiCircle,
  FiMail,
  FiUser,
} from 'react-icons/fi';
import { doc, getDoc } from 'firebase/firestore';
import nookies from 'nookies';
import auth from '../lib/firebaseAuth';
import db from '../lib/firestore';
import AuthShell from '../components/auth/AuthShell';
import {
  isValidEmail,
  isStrongPassword,
  getPasswordChecks,
  normalizeEmail,
} from '../lib/validation';
import { INDUSTRY_SECTORS } from '../lib/companyOptions';
import styles from '../styles/AuthPage.module.css';

const ACCOUNT_TYPES = [
  {
    value: 'candidato',
    title: 'Sou um candidato',
    description:
      'Crio o meu perfil, envio o currículo e apresento candidaturas.',
    Icon: FiUser,
    activeClassName: 'optionCardActiveBlue',
  },
  {
    value: 'empresa',
    title: 'Sou uma empresa',
    description:
      'Publico vagas e acompanho o recrutamento num painel dedicado.',
    Icon: FiBriefcase,
    activeClassName: 'optionCardActiveGreen',
  },
];

function normalizeAccountType(value) {
  if (value === 'empresa') return 'empresa';
  if (value === 'candidato' || value === 'candidate') return 'candidato';
  return '';
}

export default function Register() {
  const router = useRouter();
  const typeQuery = Array.isArray(router.query.type)
    ? router.query.type[0]
    : router.query.type;

  const normalizedTypeQuery = normalizeAccountType(typeQuery);
  const [accountNames, setAccountNames] = useState({
    candidato: '',
    empresa: '',
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('');

  // Campos adicionais para empresas
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyNif, setCompanyNif] = useState('');
  const [companySector, setCompanySector] = useState('');
  const [companyLocation, setCompanyLocation] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendState, setResendState] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordChecks = getPasswordChecks(password);
  const passwordRules = [
    { key: 'length', label: 'Mínimo de 8 caracteres' },
    { key: 'uppercase', label: 'Uma letra maiúscula' },
    { key: 'lowercase', label: 'Uma letra minúscula' },
    { key: 'number', label: 'Um número' },
    { key: 'special', label: 'Um símbolo especial' },
  ];
  const showPasswordRules = passwordFocused || password.length > 0;
  const name = userType ? accountNames[userType] : '';

  useEffect(() => {
    if (normalizedTypeQuery) {
      setUserType(normalizedTypeQuery);
    }
  }, [normalizedTypeQuery]);

  const handleAccountTypeChange = (nextType) => {
    setUserType(nextType);
    setError('');
  };

  const handleNameChange = (event) => {
    const value = event.target.value;
    setAccountNames((currentNames) => ({
      ...currentNames,
      [userType]: value,
    }));
  };

  const validateCompanyProfile = () => {
    if (!name.trim()) return 'Introduza o nome da empresa.';
    if (!companyPhone.trim())
      return 'Introduza o telefone de contacto da empresa.';
    if (!companyNif.trim()) return 'Introduza o NIF da empresa.';
    if (!companySector) return 'Selecione o setor de atividade da empresa.';
    if (!companyLocation.trim()) return 'Introduza a localização da empresa.';
    return '';
  };

  const handleGoogleRegister = async () => {
    setError('');

    if (!userType) {
      setError('Selecione o tipo de conta antes de continuar.');
      return;
    }

    if (userType === 'empresa') {
      const companyValidationError = validateCompanyProfile();
      if (companyValidationError) {
        setError(companyValidationError);
        return;
      }
    }

    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const token = await user.getIdToken();

      nookies.set(null, 'token', token, {
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      });

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userTypeData = userData.userType;

        if (userTypeData === 'empresa') {
          window.location.href = '/dashboard/empresa';
        } else if (userTypeData === 'admin') {
          window.location.href = '/dashboard/admin';
        } else {
          window.location.href = '/dashboard/candidato';
        }
        return;
      }

      const profileName =
        userType === 'empresa'
          ? name.trim()
          : name.trim() || user.displayName || '';
      const googlePayload = {
        userType,
        fullName: profileName,
        name: profileName,
        photoUrl: user.photoURL || '',
        provider: 'google',
      };

      if (userType === 'empresa') {
        googlePayload.phone = companyPhone.trim();
        googlePayload.nif = companyNif.trim();
        googlePayload.location = companyLocation.trim();
        googlePayload.industrySectors = [companySector];
      }

      await fetch('/api/auth/setup-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(googlePayload),
      });

      if (userType === 'empresa') {
        window.location.href = '/dashboard/empresa';
      } else {
        window.location.href = '/dashboard/candidato';
      }
    } catch (err) {
      console.error('Erro ao criar conta com Google:', err);
      setLoading(false);

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Criação da conta cancelada.');
      } else if (err.code === 'auth/popup-blocked') {
        setError(
          'A janela de autenticação foi bloqueada. Autorize janelas adicionais para este site.',
        );
      } else if (
        err.code === 'auth/unauthorized-domain' ||
        err.code === 'auth/operation-not-allowed'
      ) {
        setError(
          'O registo com Google está temporariamente indisponível neste domínio. Por favor use o email e a senha, ou tente novamente mais tarde.',
        );
      } else {
        setError(
          'Não foi possível criar a conta com o Google. Tente novamente.',
        );
      }
    }
  };

  const validate = () => {
    if (!userType) return 'Selecione o tipo de conta.';
    if (!name.trim()) {
      return userType === 'empresa'
        ? 'Introduza o nome da empresa.'
        : 'Introduza o seu nome.';
    }
    if (!email.trim()) return 'Introduza o seu email.';
    if (!isValidEmail(email)) return 'Introduza um email válido.';
    if (!isStrongPassword(password))
      return 'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo especial.';

    if (userType === 'empresa') return validateCompanyProfile();

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const normalizedEmail = normalizeEmail(email);

    // A criação da conta é o único passo cuja falha deve ser relatada como
    // "não foi possível criar a conta": depois dela, o utilizador já existe
    // no Firebase Auth, e um erro em setup-user, no envio do email ou no
    // signOut não pode reaparecer com essa mensagem — o utilizador tentaria
    // registar-se de novo e receberia "email já em uso" sem perceber porquê.
    let token;
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      token = await userCredential.user.getIdToken();
    } catch (err) {
      setLoading(false);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError(
          'A senha deve ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo especial.',
        );
      } else if (err.code === 'auth/invalid-email') {
        setError('Introduza um email válido.');
      } else {
        setError('Não foi possível criar a conta. Tente novamente.');
      }
      return;
    }

    const payload = {
      userType,
      fullName: name.trim(),
      name: name.trim(),
      provider: 'email',
    };

    if (userType === 'empresa') {
      payload.phone = companyPhone.trim();
      payload.nif = companyNif.trim();
      payload.location = companyLocation.trim();
      payload.industrySectors = [companySector];
    }

    try {
      await fetch('/api/auth/setup-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (setupError) {
      // Melhor esforço: o perfil pode ser completado mais tarde a partir do
      // painel; não bloqueia a confirmação do email.
    }

    // Enviar o nosso email de confirmação (marca EmpregoSTP). Ao contrário da
    // versão anterior, o resultado é verificado: sem isto, uma rota que
    // respondesse 503 (serviço de email por configurar) ou uma falha de rede
    // fazia a aplicação afirmar "enviámos um link de confirmação" mesmo sem
    // ter enviado nada.
    let verificationEmailSent = false;
    try {
      const verifyResponse = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      verificationEmailSent = verifyResponse.ok;
    } catch (sendError) {
      verificationEmailSent = false;
    }

    try {
      await auth.signOut();
    } catch (signOutError) {
      // A sessão local pode ficar ativa; não impede o próximo ecrã.
    }

    setLoading(false);
    setVerificationSent(true);
    if (!verificationEmailSent) {
      setResendState(
        'Não foi possível enviar o email de confirmação agora. Tente reenviar.',
      );
    }
  };

  const handleResendVerification = async () => {
    setResendState('sending');
    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password,
      );
      const token = await credential.user.getIdToken();
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      await auth.signOut();
      if (!response.ok) throw new Error('resend_failed');
      setResendState('sent');
    } catch (err) {
      console.error('Erro ao reenviar email de confirmação:', err);
      setResendState('Não foi possível reenviar. Tente novamente.');
    }
  };

  if (verificationSent) {
    return (
      <>
        <Head>
          <title>Confirmar email | EmpregoSTP</title>
        </Head>

        <AuthShell minimal>
          <div className={styles.verifyScreen}>
            <FiMail className={styles.verifyIcon} aria-hidden="true" />
            <h1 className={styles.verifyTitle}>Confirme o seu email</h1>
            <p className={styles.verifyText}>
              Enviámos um link de confirmação para{' '}
              <strong>{normalizeEmail(email)}</strong>. Abra o email e clique no
              link para ativar a sua conta. Só poderá entrar depois de
              confirmar.
            </p>

            {resendState === 'sent' ? (
              <div className={styles.info} role="status" aria-live="polite">
                <FiCheckCircle
                  className={styles.errorIcon}
                  aria-hidden="true"
                />
                <span>Email de confirmação reenviado.</span>
              </div>
            ) : resendState && resendState !== 'sending' ? (
              <div className={styles.error} role="alert">
                <FiAlertCircle
                  className={styles.errorIcon}
                  aria-hidden="true"
                />
                <span>{resendState}</span>
              </div>
            ) : null}

            <Link href="/login" className={styles.primaryButton}>
              Iniciar sessão
            </Link>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendState === 'sending'}
              className={styles.linkButton}
            >
              {resendState === 'sending'
                ? 'A reenviar…'
                : 'Não recebeu? Reenviar email'}
            </button>
          </div>
        </AuthShell>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Criar conta | EmpregoSTP</title>
      </Head>

      <AuthShell minimal wide>
        <div className={styles.formHeader}>
          <h1>Criar conta</h1>
          <p>
            Escolha como pretende utilizar a plataforma. O formulário adapta-se
            ao perfil selecionado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <fieldset className={`${styles.field} ${styles.accountTypeField}`}>
            <legend className={styles.accountTypeLegend}>Tipo de conta</legend>
            <div
              className={`${styles.optionGrid} ${styles.registerOptionGrid}`}
            >
              {ACCOUNT_TYPES.map((accountType) => {
                const { Icon } = accountType;
                const isSelected = userType === accountType.value;

                return (
                  <label
                    key={accountType.value}
                    className={`${styles.optionCard} ${
                      isSelected ? styles[accountType.activeClassName] : ''
                    }`}
                  >
                    <span className={styles.optionIcon} aria-hidden="true">
                      <Icon />
                    </span>
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>
                        {accountType.title}
                      </span>
                      <span className={styles.optionMeta}>
                        {accountType.description}
                      </span>
                    </span>
                    <input
                      type="radio"
                      name="userType"
                      value={accountType.value}
                      checked={isSelected}
                      onChange={() =>
                        handleAccountTypeChange(accountType.value)
                      }
                      className={styles.optionInput}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>

          {userType ? (
            <div className={styles.accountDetails} aria-live="polite">
              <div className={styles.accountDetailsHeader}>
                <span className={styles.accountDetailsIcon} aria-hidden="true">
                  {userType === 'empresa' ? <FiBriefcase /> : <FiUser />}
                </span>
                <div>
                  <h2>
                    {userType === 'empresa'
                      ? 'Dados da empresa'
                      : 'Dados do candidato'}
                  </h2>
                  <p>
                    {userType === 'empresa'
                      ? 'Informações necessárias para publicar vagas e gerir candidaturas.'
                      : 'Informações necessárias para criar o seu perfil profissional.'}
                  </p>
                </div>
              </div>

              <div className={styles.registrationFieldsGrid}>
                <div className={styles.field}>
                  <label htmlFor="register-name" className={styles.fieldLabel}>
                    {userType === 'empresa'
                      ? 'Nome da empresa'
                      : 'Nome completo'}
                  </label>
                  <input
                    id="register-name"
                    type="text"
                    placeholder={
                      userType === 'empresa'
                        ? 'Nome da sua empresa'
                        : 'O seu nome completo'
                    }
                    value={name}
                    onChange={handleNameChange}
                    autoComplete={
                      userType === 'empresa' ? 'organization' : 'name'
                    }
                    required
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="register-email" className={styles.fieldLabel}>
                    {userType === 'empresa' ? 'Email profissional' : 'Email'}
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    placeholder={
                      userType === 'empresa'
                        ? 'contacto@suaempresa.st'
                        : 'O seu email'
                    }
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className={styles.input}
                  />
                </div>
              </div>

              {userType === 'empresa' ? (
                <div className={styles.companyFields}>
                  <div className={styles.field}>
                    <label
                      htmlFor="company-phone"
                      className={styles.fieldLabel}
                    >
                      Telefone de contacto
                    </label>
                    <input
                      id="company-phone"
                      type="tel"
                      placeholder="+239 XXX XXXX"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      autoComplete="tel"
                      required
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="company-nif" className={styles.fieldLabel}>
                      NIF da empresa
                    </label>
                    <input
                      id="company-nif"
                      type="text"
                      placeholder="Número de identificação fiscal"
                      value={companyNif}
                      onChange={(e) => setCompanyNif(e.target.value)}
                      required
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label
                      htmlFor="company-sector"
                      className={styles.fieldLabel}
                    >
                      Setor de atividade
                    </label>
                    <select
                      id="company-sector"
                      value={companySector}
                      onChange={(e) => setCompanySector(e.target.value)}
                      required
                      className={styles.input}
                    >
                      <option value="">Selecione um setor</option>
                      {INDUSTRY_SECTORS.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label
                      htmlFor="company-location"
                      className={styles.fieldLabel}
                    >
                      Localização
                    </label>
                    <input
                      id="company-location"
                      type="text"
                      placeholder="Cidade ou distrito"
                      value={companyLocation}
                      onChange={(e) => setCompanyLocation(e.target.value)}
                      autoComplete="address-level2"
                      required
                      className={styles.input}
                    />
                  </div>
                </div>
              ) : null}

              <div className={styles.field}>
                <label
                  htmlFor="register-password"
                  className={styles.fieldLabel}
                >
                  Senha
                </label>
                <input
                  id="register-password"
                  type="password"
                  placeholder="Crie uma senha forte"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  autoComplete="new-password"
                  aria-describedby="password-requirements"
                  required
                  className={styles.input}
                />
                {showPasswordRules ? (
                  <ul
                    id="password-requirements"
                    className={styles.passwordRules}
                    aria-live="polite"
                  >
                    {passwordRules.map((rule) => {
                      const met = passwordChecks[rule.key];
                      return (
                        <li
                          key={rule.key}
                          className={`${styles.passwordRule} ${
                            met ? styles.passwordRuleMet : ''
                          }`}
                        >
                          <span
                            className={styles.passwordRuleIcon}
                            aria-hidden="true"
                          >
                            {met ? <FiCheck /> : <FiCircle />}
                          </span>
                          <span>{rule.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className={styles.error} role="alert" aria-live="polite">
              <FiAlertCircle className={styles.errorIcon} aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !userType}
            className={styles.primaryButton}
          >
            {loading
              ? 'A criar conta…'
              : userType === 'empresa'
                ? 'Criar conta da empresa'
                : userType === 'candidato'
                  ? 'Criar conta de candidato'
                  : 'Selecione o tipo de conta'}
          </button>
        </form>

        <div className={styles.divider} aria-hidden="true">
          <span className={styles.dividerLine} />
          <span>ou</span>
          <span className={styles.dividerLine} />
        </div>

        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={loading || !userType}
          className={styles.socialButton}
        >
          <svg
            className={styles.socialIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading
            ? 'A registar…'
            : userType === 'empresa'
              ? 'Continuar como empresa com Google'
              : userType === 'candidato'
                ? 'Continuar como candidato com Google'
                : 'Selecione o tipo de conta para continuar'}
        </button>

        <p className={styles.footerNote}>
          Já tem conta?{' '}
          <Link href="/login" className={styles.footerLink}>
            Iniciar sessão
          </Link>
        </p>
      </AuthShell>
    </>
  );
}
