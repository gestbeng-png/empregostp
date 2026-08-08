import { useMemo } from 'react';
import Link from 'next/link';
import {
  FiArrowUp,
  FiBookmark,
  FiBriefcase,
  FiCalendar,
  FiEye,
  FiFileText,
  FiSearch,
  FiSend,
  FiVideo,
} from 'react-icons/fi';
import styles from '../../styles/DashboardCandidato.module.css';

const STATUS_META = {
  approved: { label: 'Aprovada', tone: 'success' },
  accepted: { label: 'Aprovada', tone: 'success' },
  interview: { label: 'Entrevista', tone: 'info' },
  rejected: { label: 'Recusada', tone: 'danger' },
  pending: { label: 'Pendente', tone: 'warning' },
};

function initials(value) {
  return String(value || '?')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function asDate(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function interviewDate(application) {
  return asDate(
    application?.interviewDetails?.scheduledAt ||
      application?.interviewDate ||
      application?.scheduledAt,
  );
}

function jobTitle(item) {
  return item?.jobTitle || item?.titulo || item?.title || 'Vaga';
}

function companyName(item) {
  return (
    item?.company ||
    item?.empresa ||
    item?.empresaNome ||
    item?.companyName ||
    'Empresa'
  );
}

function buildActivity(applications) {
  const formatter = new Intl.DateTimeFormat('pt-PT', { month: 'short' });
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const value = applications.filter((application) => {
      const applied = asDate(
        application?.appliedAt ||
          application?.appliedDate ||
          application?.createdAt,
      );
      return (
        applied &&
        applied.getFullYear() === date.getFullYear() &&
        applied.getMonth() === date.getMonth()
      );
    }).length;
    return { label: formatter.format(date).replace('.', ''), value };
  });
}

export default function CandidateDashboardOverview({
  firstName,
  applications = [],
  savedJobs = [],
  interviews = [],
  profileViews = 0,
  recentApplications = [],
  recommendedJobs = [],
  profileCompletion = {},
  profileCategoryBreakdown = [],
  completionHintText,
  searchQuery = '',
  onOpenApplications,
  onOpenProfile,
}) {
  const activity = useMemo(() => buildActivity(applications), [applications]);
  const activityMax = Math.max(1, ...activity.map((item) => item.value));
  const nextInterview = interviews[0] || null;
  const nextInterviewDate = interviewDate(nextInterview);
  const nextInterviewId = nextInterview?.id || nextInterview?.applicationId;
  const activeApplications = applications.filter(
    (application) =>
      !['rejected', 'withdrawn'].includes(
        String(application?.status || '').toLowerCase(),
      ),
  ).length;
  const query = searchQuery.trim().toLocaleLowerCase('pt-PT');
  const visibleRecommendations = recommendedJobs
    .map((job) => ({
      ...job,
      dashboardJobId: job?.jobId || job?.vagaId || job?.id,
    }))
    .filter((job) => {
      if (!job.dashboardJobId) return false;
      if (!query) return true;
      return `${jobTitle(job)} ${companyName(job)} ${job?.localizacao || job?.location || ''}`
        .toLocaleLowerCase('pt-PT')
        .includes(query);
    })
    .slice(0, 3);
  const completionScore = Math.max(
    0,
    Math.min(100, Number(profileCompletion?.score) || 0),
  );

  const metrics = [
    {
      key: 'applications',
      value: activeApplications,
      label: 'Candidaturas activas',
      delta: `${applications.length} no total`,
      icon: FiSend,
      accent: '#2057d7',
      shadow: 'rgba(32,87,215,.28)',
      onClick: onOpenApplications,
    },
    {
      key: 'saved',
      value: savedJobs.length,
      label: 'Vagas guardadas',
      delta: 'Sem alteração',
      icon: FiBookmark,
      accent: '#d9ff2f',
      shadow: 'rgba(186,230,39,.28)',
      iconColor: '#162a55',
    },
    {
      key: 'interviews',
      value: interviews.length,
      label: 'Entrevistas agendadas',
      delta: 'Esta semana',
      icon: FiCalendar,
      accent: '#5fb8f5',
      shadow: 'rgba(95,184,245,.28)',
    },
    {
      key: 'views',
      value: profileViews,
      label: 'Vistas ao perfil',
      delta: 'Esta semana',
      icon: FiEye,
      accent: '#3dbb7a',
      shadow: 'rgba(61,187,122,.28)',
    },
  ];

  return (
    <div className={styles.candidateDashboardOverview}>
      <section className="header-card candidate-design-hero">
        <div>
          <div className="header-eyebrow">Candidato · Dashboard</div>
          <h1 className="header-title">
            Olá, {firstName}! <span aria-hidden="true">👋</span>
          </h1>
          <p className="header-sub">
            Tens <strong>{interviews.length} entrevistas</strong> agendadas e{' '}
            <strong>{activeApplications} candidaturas</strong> em curso.
          </p>
        </div>
        <div className="header-actions">
          <Link href="/vagas" className="btn btn-primary">
            <FiSearch /> Explorar vagas
          </Link>
          <Link href="/recursos/gerador-cv" className="btn btn-lime">
            <FiFileText /> Gerador de CV
          </Link>
        </div>
      </section>

      <section className="stats-grid" aria-label="Resumo da atividade">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const content = (
            <>
              <span
                className="stat-icon"
                style={{
                  background: metric.accent,
                  color: `var(--candidate-stat-icon-color, ${metric.iconColor || '#fff'})`,
                  boxShadow: `var(--candidate-stat-icon-shadow, 0 8px 20px ${metric.shadow})`,
                }}
              >
                <Icon />
              </span>
              <span className="stat-value">{metric.value}</span>
              <span className="stat-label">{metric.label}</span>
              <span className="stat-delta up">
                {metric.key === 'applications' && (
                  <FiArrowUp aria-hidden="true" />
                )}
                {metric.delta}
              </span>
            </>
          );
          return metric.onClick ? (
            <button
              key={metric.key}
              type="button"
              className="stat-card"
              data-metric={metric.key}
              onClick={metric.onClick}
            >
              {content}
            </button>
          ) : (
            <div
              key={metric.key}
              className="stat-card"
              data-metric={metric.key}
            >
              {content}
            </div>
          );
        })}
      </section>

      <div className="grid-2 candidate-design-grid">
        <div className="candidate-design-column">
          <section className="panel">
            <div className="panel-title">
              Candidaturas recentes{' '}
              <span className="panel-badge">{applications.length}</span>
            </div>
            <div className="candidate-design-list">
              {recentApplications.slice(0, 4).map((application) => {
                const statusKey = String(
                  application?.status || 'pending',
                ).toLowerCase();
                const status = STATUS_META[statusKey] || STATUS_META.pending;
                return (
                  <button
                    key={application.id}
                    type="button"
                    className="candidate-design-row"
                    onClick={onOpenApplications}
                  >
                    <span className="candidate-design-avatar">
                      {initials(companyName(application))}
                    </span>
                    <span className="candidate-design-row-copy">
                      <strong>{jobTitle(application)}</strong>
                      <small>{companyName(application)}</small>
                    </span>
                    <span
                      className={`candidate-design-status tone-${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </button>
                );
              })}
              {recentApplications.length === 0 && (
                <div className="candidate-design-empty">
                  Ainda não enviou candidaturas.
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm candidate-design-full"
              onClick={onOpenApplications}
            >
              Ver todas as candidaturas
            </button>
          </section>

          <section className="panel">
            <div className="panel-title">Actividade (últimos 6 meses)</div>
            <div
              className="chart-bars candidate-design-chart"
              aria-label="Candidaturas por mês"
            >
              {activity.map((item, index) => (
                <div className="chart-bar-wrap" key={`${item.label}-${index}`}>
                  <span className="chart-bar-val">{item.value}</span>
                  <span
                    className={`chart-bar${index === activity.length - 2 ? ' lime' : ''}`}
                    style={{
                      height: `${Math.max(8, (item.value / activityMax) * 100)}%`,
                    }}
                  />
                  <span className="chart-bar-label">{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="candidate-design-column">
          <section className="panel">
            <div className="panel-title">Perfil completo</div>
            <div className="candidate-design-completion">
              <div
                className="candidate-design-ring"
                style={{
                  '--candidate-progress': `${completionScore * 3.6}deg`,
                }}
                aria-label={`${completionScore}% completo`}
              >
                <span>{completionScore}%</span>
              </div>
              <div>
                <strong>
                  {completionScore >= 70
                    ? 'Bom progresso!'
                    : 'Continue a completar'}
                </strong>
                <p>{completionHintText}</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onOpenProfile}
                >
                  Completar perfil
                </button>
              </div>
            </div>
            <div className="candidate-design-progress-list">
              {profileCategoryBreakdown.slice(0, 4).map((category) => (
                <div key={category.id} className="candidate-design-progress">
                  <div>
                    <span>{category.label}</span>
                    <strong>{category.percent}%</strong>
                  </div>
                  <span className="candidate-design-track">
                    <span style={{ width: `${category.percent}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel candidate-design-interview">
            <div className="panel-title">Próxima entrevista</div>
            {nextInterview ? (
              <>
                <strong>{jobTitle(nextInterview)}</strong>
                <p>
                  {companyName(nextInterview)} · Entrevista{' '}
                  {nextInterview?.interviewDetails?.mode === 'in_person'
                    ? 'presencial'
                    : 'online'}
                </p>
                <div className="candidate-design-interview-foot">
                  <span>
                    <FiCalendar />{' '}
                    {nextInterviewDate
                      ? nextInterviewDate.toLocaleString('pt-PT', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Data a confirmar'}
                  </span>
                  <span className="candidate-design-interview-actions">
                    {nextInterviewId ? (
                      <a
                        className="dash-icon-btn candidate-design-calendar-action"
                        href={`/api/applications/${encodeURIComponent(nextInterviewId)}/interview-ics`}
                        aria-label="Adicionar entrevista ao calendário"
                        title="Adicionar ao calendário"
                      >
                        <FiCalendar />
                      </a>
                    ) : null}
                    {nextInterview?.interviewDetails?.meetingLink ? (
                      <a
                        className="btn btn-primary btn-sm"
                        href={nextInterview.interviewDetails.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FiVideo /> Entrar
                      </a>
                    ) : null}
                  </span>
                </div>
              </>
            ) : (
              <div className="candidate-design-empty">
                Nenhuma entrevista agendada.
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="panel candidate-design-recommendations">
        <div className="panel-title">
          Vagas recomendadas <span className="panel-badge">Para ti</span>
        </div>
        <div className="candidate-design-jobs">
          {visibleRecommendations.map((job) => (
            <Link
              key={job.dashboardJobId}
              href={`/vaga/${encodeURIComponent(job.dashboardJobId)}`}
              className="candidate-design-job"
            >
              <span className="candidate-design-job-icon">
                <FiBriefcase />
              </span>
              <span className="candidate-design-row-copy">
                <strong>{jobTitle(job)}</strong>
                <small>
                  {companyName(job)} ·{' '}
                  {job?.localizacao || job?.location || 'São Tomé'}
                </small>
              </span>
              <span className="candidate-design-job-badge">
                {job?.destaque || job?.featured ? 'Destaque' : 'Nova'}
              </span>
            </Link>
          ))}
          {visibleRecommendations.length === 0 && (
            <div className="candidate-design-empty">
              {query
                ? 'Nenhuma vaga corresponde à pesquisa.'
                : 'Complete o perfil para receber recomendações.'}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
