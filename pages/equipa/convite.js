import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardShell from '../../components/dashboard/DashboardShell';
import { ActionForm } from '../../components/empresa/RecruitmentControls';
import { requireSession } from '../../lib/serverSession';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/apiClient';
import { buildLoginUrl } from '../../lib/loginRedirect';
import {
  createServerSession,
  destroyServerSession,
} from '../../lib/authSessionClient';
import {
  recruitmentDate,
  teamRoleDescription,
  teamRoleLabel,
} from '../../lib/recruitmentLabels';
import styles from '../../styles/RecruitmentWorkspace.module.css';

/** This is the exact acceptPath returned by the invitation API. No automatic acceptance. */
export default function InvitationPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [organizationId, setOrganizationId] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const id = typeof router.query.i === 'string' ? router.query.i : '';
  const token = typeof router.query.t === 'string' ? router.query.t : '';
  useEffect(() => {
    if (!router.isReady || !id || !token || accepted) return undefined;
    const controller = new AbortController();
    setPreview(null);
    setError('');
    apiRequest(`/api/invitations/${encodeURIComponent(id)}/preview`, {
      method: 'POST',
      body: { token },
      signal: controller.signal,
    })
      .then((value) => {
        if (!controller.signal.aborted) setPreview(value);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(err.message || 'Não foi possível consultar este convite.');
      });
    return () => controller.abort();
  }, [router.isReady, id, token, accepted, reload]);
  const switchAccount = async () => {
    setBusy(true);
    setError('');
    try {
      const { auth, signOut } = await import('../../lib/authClientRuntime');
      await destroyServerSession();
      await signOut(auth);
      window.location.assign(
        buildLoginUrl(
          `/equipa/convite?i=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`,
        ),
      );
    } catch {
      setError('Não foi possível terminar a sessão. Tente novamente.');
      setBusy(false);
    }
  };
  return (
    <>
      <Head>
        <title>Convite de equipa · EmpregoSTP</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Head>
      <DashboardShell
        role="empresa"
        active="recruitment"
        title="Convite de equipa"
        subtitle="Acesso à organização"
        nav={[
          {
            label: 'Acesso',
            items: [
              {
                key: 'recruitment',
                label: 'Recrutamento e equipa',
                href: '/dashboard/recrutamento',
                icon: 'users',
              },
              {
                key: 'account',
                label: 'A minha conta',
                href: '/dashboard',
                icon: 'user',
              },
            ],
          },
        ]}
      >
        <section className={styles.panel}>
          <h1>Aceitar convite de equipa</h1>
          <p>
            Use a conta do email convidado, com o email verificado. Aceitar não
            altera o seu tipo de conta pessoal.
          </p>
          {accepted ? (
            <p role="status">
              Convite aceite.{' '}
              <Link
                href={`/dashboard/recrutamento${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`}
              >
                Abrir recrutamento da organização
              </Link>
            </p>
          ) : router.isReady &&
            id &&
            token &&
            preview?.status === 'PENDING' &&
            preview.emailMatches &&
            preview.emailVerified ? (
            <>
              <h2>{preview.organizationName}</h2>
              <p>
                Entrará como <strong>{teamRoleLabel(preview.role)}</strong>.{' '}
                {teamRoleDescription(preview.role)}
              </p>
              <p>
                Válido até {recruitmentDate(preview.expiresAt)} (hora de São
                Tomé).
              </p>
              <ActionForm
                title="Aceitação do convite"
                path={`/api/invitations/${encodeURIComponent(id)}/accept`}
                buildBody={() => ({ token })}
                confirmText="Aceito integrar esta organização com o papel do convite."
                submit="Aceitar convite"
                onSuccess={(value) => {
                  setOrganizationId(
                    value.organizationId || preview.organizationId,
                  );
                  setAccepted(true);
                  router.replace('/equipa/convite', undefined, {
                    shallow: true,
                  });
                }}
              />
            </>
          ) : preview && preview.status !== 'PENDING' ? (
            <div role="status">
              <h2>
                {preview.status === 'EXPIRED'
                  ? 'Este convite expirou'
                  : preview.status === 'ACCEPTED'
                    ? 'Este convite já foi aceite'
                    : 'Este convite foi revogado'}
              </h2>
              <p>
                {preview.status === 'ACCEPTED'
                  ? 'Se aceitou este convite, abra a organização no seu painel. Se o seu acesso foi removido, contacte o administrador.'
                  : 'Peça uma nova ligação ao administrador da organização.'}
              </p>
              <Link href="/dashboard/recrutamento">
                Consultar as minhas organizações
              </Link>
            </div>
          ) : preview && !preview.emailMatches ? (
            <div role="alert">
              <h2>Está numa conta diferente da convidada</h2>
              <p>
                Entre com o email que recebeu o convite para{' '}
                {preview.organizationName}. O convite não pode ser aceite por
                outra conta.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={switchAccount}
              >
                Entrar com outra conta
              </button>
            </div>
          ) : preview && !preview.emailVerified ? (
            <div role="status">
              <h2>Confirme o seu email antes de aceitar</h2>
              <p>
                Abra a mensagem de confirmação do EmpregoSTP. Depois de
                verificar o email, atualize a sessão aqui.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { auth } =
                      await import('../../lib/authClientRuntime');
                    await auth.currentUser?.reload();
                    const fresh = await auth.currentUser?.getIdToken(true);
                    if (fresh) await createServerSession(fresh);
                    setReload((value) => value + 1);
                  } catch {
                    setError(
                      'Não foi possível atualizar a sessão. Tente novamente.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Já confirmei o meu email
              </button>
            </div>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setReload((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </div>
          ) : router.isReady && id && token ? (
            <p role="status">A verificar convite…</p>
          ) : router.isReady ? (
            <p role="alert">
              A ligação do convite está incompleta. Peça um novo convite à
              organização.
            </p>
          ) : (
            <p role="status">A carregar convite…</p>
          )}
          {error && preview ? <p role="alert">{error}</p> : null}
        </section>
      </DashboardShell>
    </>
  );
}
export async function getServerSideProps(context) {
  context.res.setHeader('Cache-Control', 'private, no-store');
  context.res.setHeader('Referrer-Policy', 'no-referrer');
  context.res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const guard = await requireSession(context);
  return guard || { props: {} };
}
