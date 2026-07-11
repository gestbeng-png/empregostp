/**
 * Navigation config for the dashboard shell, per role.
 * `icon` values are keys resolved to react-icons inside DashboardShell.
 * Only routes that exist in /pages are linked.
 */

export const DASHBOARD_NAV = {
  admin: [
    {
      label: "Gestão",
      items: [
        { key: "overview", label: "Visão geral", href: "/dashboard/admin", icon: "home" },
        { key: "users", label: "Utilizadores", href: "/dashboard/admin/users", icon: "users" },
        { key: "jobs", label: "Vagas", href: "/dashboard/admin/jobs", icon: "briefcase" },
        {
          key: "verificacoes",
          label: "Verificações",
          href: "/dashboard/admin/verificacoes",
          icon: "shield",
        },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { key: "blog", label: "Blog", href: "/dashboard/admin/blog", icon: "fileText" },
        { key: "news", label: "Notícias", href: "/dashboard/admin/news", icon: "rss" },
        { key: "resources", label: "Recursos", href: "/dashboard/admin/resources", icon: "folder" },
        { key: "services", label: "Serviços", href: "/dashboard/admin/services", icon: "tool" },
        { key: "hr-services", label: "Serviços RH", href: "/dashboard/admin/hr-services", icon: "briefcase" },
      ],
    },
    {
      label: "Negócio",
      items: [
        { key: "plans", label: "Planos", href: "/dashboard/admin/plans", icon: "star" },
        {
          key: "payments",
          label: "Pagamentos",
          href: "/dashboard/admin/payment-settings",
          icon: "creditCard",
        },
        {
          key: "subscriptions",
          label: "Solicitações",
          href: "/dashboard/admin/subscription-requests",
          icon: "inbox",
        },
        {
          key: "affiliates",
          label: "Afiliados",
          href: "/dashboard/admin/affiliates",
          icon: "users",
        },
      ],
    },
    {
      label: "Sistema",
      items: [
        { key: "reports", label: "Relatórios", href: "/dashboard/admin/reports", icon: "chart" },
        { key: "audit", label: "Auditoria", href: "/dashboard/admin/auditoria", icon: "list" },
      ],
    },
  ],
  candidato: [
    {
      label: "Painel",
      items: [
        { key: "overview", label: "Visão geral", href: "/dashboard/candidato", icon: "home" },
        {
          key: "candidaturas",
          label: "Candidaturas",
          href: "/dashboard/candidato/candidaturas",
          icon: "send",
        },
        {
          key: "saved",
          label: "Vagas guardadas",
          href: "/dashboard/candidato/vaga",
          icon: "bookmark",
        },
      ],
    },
    {
      label: "Explorar",
      items: [
        { key: "vagas", label: "Procurar vagas", href: "/vagas", icon: "search" },
        { key: "recursos", label: "Recursos", href: "/recursos", icon: "tool" },
        { key: "profile", label: "Meu perfil", href: "/profile", icon: "user" },
      ],
    },
  ],
  empresa: [
    {
      label: "Menu Principal",
      items: [
        { key: "dashboard", label: "Visão geral", href: "/dashboard/empresa", icon: "home" },
        { key: "jobs", label: "Minhas vagas", href: "/dashboard/empresa?tab=jobs", icon: "briefcase" },
        { key: "applications", label: "Candidaturas", href: "/dashboard/empresa?tab=applications", icon: "inbox" },
        { key: "candidates", label: "Banco de talentos", href: "/dashboard/empresa?tab=candidates", icon: "users" },
        { key: "interviews", label: "Entrevistas", href: "/dashboard/empresa?tab=interviews", icon: "calendar" },
        { key: "messages", label: "Mensagens", href: "/dashboard/empresa?tab=messages", icon: "messages" },
      ],
    },
    {
      label: "Análise",
      items: [
        { key: "analytics", label: "Analytics", href: "/dashboard/empresa?tab=analytics", icon: "chart" },
      ],
    },
    {
      label: "Conta",
      items: [
        { key: "company-profile", label: "Perfil empresa", href: "/dashboard/empresa/profile", icon: "user" },
        { key: "plans", label: "Planos", href: "/dashboard/empresa?tab=plans", icon: "star" },
      ],
    },
  ],
};

export const ROLE_LABEL = {
  admin: "Administrador",
  candidato: "Candidato",
  empresa: "Empresa",
};

export function getDashboardNav(role) {
  return DASHBOARD_NAV[role] || DASHBOARD_NAV.admin;
}
