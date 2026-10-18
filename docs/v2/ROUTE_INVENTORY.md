# Inventário de rotas

Gerado a partir do código em 88d35f4. Branch: feat/empregostp-marketplace-v2.

73 páginas; 120 APIs. Estado HTTP, tráfego e indexação efetiva ainda por medir. Sinais de autenticação são evidência textual, não prova de autorização. Rotas dinâmicas exigem IDs semeados em staging.

| Rota | Fonte | Role previsto | Renderização | Auth no código | SEO / título | Estado HTTP |
|---|---|---|---|---|---|---|
| /alertas/cancelar | pages/alertas/cancelar.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Cancelar alerta de vagas - EmpregoSTP | não verificado |
| /api/admin | pages/api/admin.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/activities | pages/api/admin/activities/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/affiliates/[id] | pages/api/admin/affiliates/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/affiliates | pages/api/admin/affiliates/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/hr-services/[id] | pages/api/admin/hr-services/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/hr-services | pages/api/admin/hr-services/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/jobs/[id] | pages/api/admin/jobs/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/jobs/[id]/moderate | pages/api/admin/jobs/[id]/moderate.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/jobs | pages/api/admin/jobs/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/moderation-settings | pages/api/admin/moderation-settings.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/operations | pages/api/admin/operations.ts | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/admin/payment-settings | pages/api/admin/payment-settings.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/plans/[id] | pages/api/admin/plans/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/plans | pages/api/admin/plans/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/plans/setup | pages/api/admin/plans/setup.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/product-ads/[id] | pages/api/admin/product-ads/[id].js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/admin/product-ads | pages/api/admin/product-ads/index.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/admin/product-ads/upload | pages/api/admin/product-ads/upload.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/admin/recruitment | pages/api/admin/recruitment.ts | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/admin/services/[id] | pages/api/admin/services/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/services | pages/api/admin/services/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/subscription-requests/[id] | pages/api/admin/subscription-requests/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/subscription-requests | pages/api/admin/subscription-requests/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/testimonials/[id] | pages/api/admin/testimonials/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/testimonials | pages/api/admin/testimonials/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/users/[id] | pages/api/admin/users/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/users | pages/api/admin/users/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/verifications | pages/api/admin/verifications.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/admin/verify-action | pages/api/admin/verify-action.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/affiliate/apply | pages/api/affiliate/apply.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/analytics | pages/api/analytics.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/applications/[id]/cv | pages/api/applications/[id]/cv.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications/[id]/hire | pages/api/applications/[id]/hire.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications/[id] | pages/api/applications/[id]/index.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications/[id]/interview-ics | pages/api/applications/[id]/interview-ics.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/applications/[id]/interview-response | pages/api/applications/[id]/interview-response.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/applications/[id]/interviews | pages/api/applications/[id]/interviews.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications/[id]/notes | pages/api/applications/[id]/notes.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications/[id]/review | pages/api/applications/[id]/review.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications/[id]/status | pages/api/applications/[id]/status.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/applications/[id]/timeline | pages/api/applications/[id]/timeline.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/applications/[id]/transition | pages/api/applications/[id]/transition.ts | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/applications/[id]/withdraw | pages/api/applications/[id]/withdraw.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/applications/assignments | pages/api/applications/assignments.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/applications | pages/api/applications/index.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/auth/register | pages/api/auth/register.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/auth/send-password-reset | pages/api/auth/send-password-reset.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/auth/send-verification | pages/api/auth/send-verification.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/auth/session | pages/api/auth/session.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/auth/setup-user | pages/api/auth/setup-user.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/bulk-actions/[id]/cancel | pages/api/bulk-actions/[id]/cancel.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/bulk-actions/[id]/execute | pages/api/bulk-actions/[id]/execute.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/bulk-actions | pages/api/bulk-actions/index.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/candidate/plan-status | pages/api/candidate/plan-status.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/candidate/plans | pages/api/candidate/plans.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/candidate/settings | pages/api/candidate/settings.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/career-advice | pages/api/career-advice.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/contact | pages/api/contact/index.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/ats-daily | pages/api/cron/ats-daily.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/check-job-expiration | pages/api/cron/check-job-expiration.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/check-plan-expiration | pages/api/cron/check-plan-expiration.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/expire-offers | pages/api/cron/expire-offers.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/interview-reminders | pages/api/cron/interview-reminders.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/process-outbox | pages/api/cron/process-outbox.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/cron/readiness | pages/api/cron/readiness.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/drafts/[scope] | pages/api/drafts/[scope].js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/empresa | pages/api/empresa.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/export/applications | pages/api/export/applications.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/files/application-document | pages/api/files/application-document.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/files/candidate-certificate | pages/api/files/candidate-certificate.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/files/candidate-cv | pages/api/files/candidate-cv.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/health | pages/api/health.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/hires/[id]/annul | pages/api/hires/[id]/annul.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/hires/[id]/confirm | pages/api/hires/[id]/confirm.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/hr-services | pages/api/hr-services/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/interviews/[id]/[action] | pages/api/interviews/[id]/[action].ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/interviews/[id]/ics | pages/api/interviews/[id]/ics.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/invitations/[id]/accept | pages/api/invitations/[id]/accept.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/invitations/[id] | pages/api/invitations/[id]/index.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/invitations/[id]/preview | pages/api/invitations/[id]/preview.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/invitations/[id]/revoke | pages/api/invitations/[id]/revoke.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/job-alerts | pages/api/job-alerts/index.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/job-alerts/unsubscribe | pages/api/job-alerts/unsubscribe.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs/[id] | pages/api/jobs/[id].js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/jobs/[id]/close | pages/api/jobs/[id]/close.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs/[id]/closing-message | pages/api/jobs/[id]/closing-message.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs/[id]/destaque | pages/api/jobs/[id]/destaque.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/jobs/[id]/fill | pages/api/jobs/[id]/fill.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs/[id]/hiring-team | pages/api/jobs/[id]/hiring-team.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs/active | pages/api/jobs/active.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs/categories | pages/api/jobs/categories.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/jobs | pages/api/jobs/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/me/organizations | pages/api/me/organizations.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/messages/[conversationId] | pages/api/messages/[conversationId].js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/messages | pages/api/messages/index.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/news | pages/api/news.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/newsletter/broadcast | pages/api/newsletter/broadcast.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/newsletter/subscribe | pages/api/newsletter/subscribe.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/notifications | pages/api/notifications.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/organizations/[id]/invitations | pages/api/organizations/[id]/invitations.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/organizations/[id]/members/[userId] | pages/api/organizations/[id]/members/[userId].ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/organizations/[id]/message-templates | pages/api/organizations/[id]/message-templates.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/organizations/[id]/ownership-transfer/accept | pages/api/organizations/[id]/ownership-transfer/accept.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/organizations/[id]/ownership-transfer | pages/api/organizations/[id]/ownership-transfer/index.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/profile | pages/api/profile.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/profile/update | pages/api/profile/update.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/profile/upload-cv | pages/api/profile/upload-cv.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/push-subscriptions | pages/api/push-subscriptions/index.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/recommendations | pages/api/recommendations.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/reports | pages/api/reports/index.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/resources/download | pages/api/resources/download.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/saved-jobs | pages/api/saved-jobs.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/subscribe-plan | pages/api/subscribe-plan.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/subscription-requests/[id]/payment-proof | pages/api/subscription-requests/[id]/payment-proof.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/subscription-requests/current | pages/api/subscription-requests/current.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/talent-pool | pages/api/talent-pool.js | API: autorização individual | API | verifyIdToken | não declarado na rota | não verificado |
| /api/testimonials | pages/api/testimonials/index.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/track-view | pages/api/track-view.js | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /api/verifications | pages/api/verifications.js | API: autorização individual | API | requireActiveApiUser | não declarado na rota | não verificado |
| /api/workspace | pages/api/workspace.ts | API: autorização individual | API | revisão manual necessária | não declarado na rota | não verificado |
| /blog | pages/blog.js | público/condicional | SSR | revisão manual necessária | Blog \\| EmpregoSTP | não verificado |
| /blog/[id] | pages/blog/[id].js | público/condicional | SSG/ISR | revisão manual necessária | {post.title} \\| Blog EmpregoSTP | não verificado |
| /candidatos | pages/candidatos.js | público/condicional | SSR | revisão manual necessária | não declarado na rota | não verificado |
| /candidatos/[id] | pages/candidatos/[id].js | público/condicional | SSR | verifyIdToken | {candidato.fullName} \\| Candidato — EmpregoSTP | não verificado |
| /candidatos/internacional | pages/candidatos/internacional.js | público/condicional | SSR | revisão manual necessária | não declarado na rota | não verificado |
| /candidatos/nacional | pages/candidatos/nacional.js | público/condicional | SSR | revisão manual necessária | não declarado na rota | não verificado |
| /carreira | pages/carreira.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Serviços de carreira \\| EmpregoSTP | não verificado |
| /contacto | pages/contacto.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Contacto \\| EmpregoSTP | não verificado |
| /cookies | pages/cookies.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Cookies \\| EmpregoSTP | não verificado |
| /dashboard/admin/affiliates | pages/dashboard/admin/affiliates.js | ADMIN | SSR | requireAdminPageAuth | Afiliados - Admin | não verificado |
| /dashboard/admin/auditoria | pages/dashboard/admin/auditoria.js | ADMIN | SSR | requireAdminPageAuth | Auditoria \\| Admin EmpregoSTP | não verificado |
| /dashboard/admin/blog/[id] | pages/dashboard/admin/blog/[id].js | ADMIN | SSR | verifyIdToken | {isNew ? 'Novo Artigo' : 'Editar Artigo'} \\| Admin EmpregoSTP | não verificado |
| /dashboard/admin/blog | pages/dashboard/admin/blog/index.js | ADMIN | SSR | verifyIdToken | Gerir blog \\| Admin EmpregoSTP | não verificado |
| /dashboard/admin/hr-services | pages/dashboard/admin/hr-services.js | ADMIN | SSR | requireAdminPageAuth | Serviços RH - Admin | não verificado |
| /dashboard/admin | pages/dashboard/admin/index.js | ADMIN | SSR | verifyIdToken | Dashboard Admin - EmpregoSTP | não verificado |
| /dashboard/admin/jobs | pages/dashboard/admin/jobs.js | ADMIN | SSR | verifyIdToken | Gerir vagas - Admin | não verificado |
| /dashboard/admin/jobs/[id]/edit | pages/dashboard/admin/jobs/[id]/edit.js | ADMIN | SSR | verifyIdToken | Editar Vaga - Admin Dashboard | não verificado |
| /dashboard/admin/jobs/[id] | pages/dashboard/admin/jobs/[id]/index.js | ADMIN | SSR | verifyIdToken | Vaga não encontrada - Admin; {job.titulo} - Admin | não verificado |
| /dashboard/admin/jobs/create | pages/dashboard/admin/jobs/create.js | ADMIN | SSR | verifyIdToken | Criar Vaga (Admin) \\| EmpregoSTP | não verificado |
| /dashboard/admin/news/[id] | pages/dashboard/admin/news/[id].js | ADMIN | SSR | verifyIdToken | {isNew ? 'Nova Notícia' : 'Editar Notícia'} \\| Admin EmpregoSTP | não verificado |
| /dashboard/admin/news | pages/dashboard/admin/news/index.js | ADMIN | SSR | verifyIdToken | Gerir notícias \\| Admin EmpregoSTP | não verificado |
| /dashboard/admin/operations | pages/dashboard/admin/operations.js | ADMIN | SSR | requireAdminPageAuth | Operações de recrutamento · EmpregoSTP | não verificado |
| /dashboard/admin/payment-settings | pages/dashboard/admin/payment-settings.js | ADMIN | SSR | requireAdminPageAuth | Configurações de Pagamento - Admin | não verificado |
| /dashboard/admin/plans | pages/dashboard/admin/plans.js | ADMIN | SSR | requireAdminPageAuth | Gerir planos - Admin | não verificado |
| /dashboard/admin/product-ads | pages/dashboard/admin/product-ads.js | ADMIN | SSR | requireAdminPageAuth | Anúncios de produtos - Administração | não verificado |
| /dashboard/admin/reports | pages/dashboard/admin/reports.js | ADMIN | SSR | verifyIdToken | Relatórios - Admin Dashboard | não verificado |
| /dashboard/admin/resources/[id] | pages/dashboard/admin/resources/[id].js | ADMIN | SSR | verifyIdToken | {isNew ? 'Novo Item' : 'Editar Item'} \\| Admin Recursos | não verificado |
| /dashboard/admin/resources | pages/dashboard/admin/resources/index.js | ADMIN | SSR | verifyIdToken | Gerir recursos \\| Admin EmpregoSTP | não verificado |
| /dashboard/admin/services | pages/dashboard/admin/services.js | ADMIN | SSR | verifyIdToken | Gerir serviços - Admin | não verificado |
| /dashboard/admin/services/[id] | pages/dashboard/admin/services/[id].js | ADMIN | SSR | verifyIdToken | Admin - Serviço {svc?.title \\|\\| svc?.id} | não verificado |
| /dashboard/admin/subscription-requests | pages/dashboard/admin/subscription-requests.js | ADMIN | SSR | requireAdminPageAuth | Solicitações de Assinatura - Admin | não verificado |
| /dashboard/admin/testimonials | pages/dashboard/admin/testimonials.js | ADMIN | SSR | requireAdminPageAuth | Moderar testemunhos - Admin | não verificado |
| /dashboard/admin/users | pages/dashboard/admin/users.js | ADMIN | SSR | verifyIdToken | Gerir utilizadores - Admin | não verificado |
| /dashboard/admin/users/[id]/edit | pages/dashboard/admin/users/[id]/edit.js | ADMIN | SSR | verifyIdToken | Editar utilizador - Admin | não verificado |
| /dashboard/admin/users/[id] | pages/dashboard/admin/users/[id]/index.js | ADMIN | SSR | verifyIdToken | Utilizador não encontrado - Admin; {user.name \\|\\| user.email} - Admin | não verificado |
| /dashboard/admin/verificacoes | pages/dashboard/admin/verificacoes.js | ADMIN | SSR | requireAdminPageAuth | Verificações \\| Admin EmpregoSTP | não verificado |
| /dashboard/candidato/candidaturas | pages/dashboard/candidato/candidaturas.js | candidato | SSR | revisão manual necessária | Minhas Candidaturas - EmpregoSTP; Minhas Candidaturas - EmpregoSTP; Minhas Candidaturas - EmpregoSTP | não verificado |
| /dashboard/candidato | pages/dashboard/candidato/index.js | candidato | SSR | revisão manual necessária | Dashboard Candidato \\| EmpregoSTP | não verificado |
| /dashboard/candidato/vaga | pages/dashboard/candidato/vaga/index.js | candidato | SSR | revisão manual necessária | não declarado na rota | não verificado |
| /dashboard/empresa/candidato/[id] | pages/dashboard/empresa/candidato/[id].js | empresa | SSR | verifyIdToken | Candidato não encontrado - EmpregoSTP; {candidato.fullName \\|\\| 'Candidato'} - EmpregoSTP | não verificado |
| /dashboard/empresa | pages/dashboard/empresa/index.js | empresa | SSR | verifyIdToken | Painel da empresa \\| EmpregoSTP | não verificado |
| /dashboard/empresa/profile | pages/dashboard/empresa/profile.js | empresa | SSR | revisão manual necessária | Perfil da Empresa - EmpregoSTP; Perfil da Empresa - EmpregoSTP | não verificado |
| /dashboard/empresa/vaga/[id] | pages/dashboard/empresa/vaga/[id].js | empresa | SSR | verifyIdToken | Vaga nao encontrada - EmpregoSTP; {titulo} - EmpregoSTP | não verificado |
| /dashboard/empresa/vaga/criar-vaga | pages/dashboard/empresa/vaga/criar-vaga.js | empresa | SSR | revisão manual necessária | {isEditMode ? "Editar Vaga" : "Criar Vaga"} - EmpregoSTP | não verificado |
| /dashboard/empresa/vagas | pages/dashboard/empresa/vagas.js | empresa | SSR | revisão manual necessária | Gerir vagas - EmpregoSTP | não verificado |
| /dashboard | pages/dashboard/index.js | autenticado | SSR | revisão manual necessária | A abrir o seu painel \\| EmpregoSTP | não verificado |
| /dashboard/recrutamento | pages/dashboard/recrutamento.js | público/condicional | SSR | revisão manual necessária | Recrutamento · EmpregoSTP | não verificado |
| /empresas | pages/empresas.js | público/condicional | SSR | revisão manual necessária | Ferramentas de Recrutamento Profissional \\| EmpregoSTP | não verificado |
| /empresas/[id] | pages/empresas/[id].js | público/condicional | SSR | revisão manual necessária | {company.name} \\| Empresa — EmpregoSTP | não verificado |
| /equipa/convite | pages/equipa/convite.js | público/condicional | SSR | revisão manual necessária | Convite de equipa · EmpregoSTP | não verificado |
| / | pages/index.js | público/condicional | SSR | revisão manual necessária | Empregos STP - Conectando Talentos ao Sucesso | não verificado |
| /login | pages/login.js | público/condicional | SSR | revisão manual necessária | Iniciar sessão \\| EmpregoSTP | não verificado |
| /offline | pages/offline.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Sem ligação \\| EmpregoSTP | não verificado |
| /politica-privacidade | pages/politica-privacidade.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Política de privacidade \\| EmpregoSTP | não verificado |
| /premium | pages/premium.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | A abrir os seus planos \\| EmpregoSTP | não verificado |
| /premium/candidatos | pages/premium/candidatos.js | público/condicional | SSR | verifyIdToken | não declarado na rota | não verificado |
| /premium/empresa | pages/premium/empresa.js | público/condicional | SSR | verifyIdToken | não declarado na rota | não verificado |
| /profile | pages/profile/index.js | candidato | SSR | revisão manual necessária | A abrir o seu perfil \\| EmpregoSTP | não verificado |
| /recuperar-senha | pages/recuperar-senha.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Recuperar senha \\| EmpregoSTP | não verificado |
| /recursos | pages/recursos.js | público/condicional | SSR | revisão manual necessária | Recursos gratuitos \\| EmpregoSTP | não verificado |
| /recursos/calculadora-impostos | pages/recursos/calculadora-impostos.js | público/condicional | SSR | revisão manual necessária | Calculadora de Impostos \\| Recursos EmpregoSTP | não verificado |
| /recursos/calculadora-salarial | pages/recursos/calculadora-salarial.js | público/condicional | SSR | revisão manual necessária | Calculadora Salarial \\| Recursos EmpregoSTP | não verificado |
| /recursos/gerador-cv | pages/recursos/gerador-cv.js | público/condicional | SSR | revisão manual necessária | {title} | não verificado |
| /recursos/guia/[id] | pages/recursos/guia/[id].js | público/condicional | SSR | revisão manual necessária | {guide.title} \\| Guia EmpregoSTP | não verificado |
| /redefinir-senha | pages/redefinir-senha.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Redefinir senha \\| EmpregoSTP | não verificado |
| /register | pages/register.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Confirmar email \\| EmpregoSTP; Criar conta \\| EmpregoSTP | não verificado |
| /setup/seed | pages/setup/seed.js | restrita: setup | SSR | requireAdminPageAuth | Preparar dados de desenvolvimento \\| EmpregoSTP | não verificado |
| /sobre-nos | pages/sobre-nos.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Sobre nós \\| Emprego STP | não verificado |
| /termos | pages/termos.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Termos de utilização \\| EmpregoSTP | não verificado |
| /vaga/[id] | pages/vaga/[id].js | público/condicional | SSR | revisão manual necessária | Vaga retirada \\| EmpregoSTP; {titulo} \\| EmpregoSTP | não verificado |
| /vagas | pages/vagas/index.js | público/condicional | SSR | revisão manual necessária | Vagas de emprego \\| EmpregoSTP | não verificado |
| /verificar-email | pages/verificar-email.js | público/condicional | sem SSR de dados; confirmar CSR | revisão manual necessária | Confirmar email \\| EmpregoSTP | não verificado |
