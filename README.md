# 🚀 EmpregosSTP

<div align="center">
  <img src="./public/assets/Emprego STP Logo (2) 1.png" alt="EmpregosSTP Logo" height="80">
  
  ### Plataforma de Vagas de Emprego em São Tomé e Príncipe
  
  [![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.1.0-blue?style=for-the-badge&logo=react)](https://reactjs.org/)
  [![Firebase](https://img.shields.io/badge/Firebase-11.10.0-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
  
  
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEdmirsantos%2FEmpregoSTP&project-name=empregostp&repository-name=EmpregoSTP&env=NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,FIREBASE_PROJECT_ID,FIREBASE_CLIENT_EMAIL,FIREBASE_PRIVATE_KEY">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
</div>

---

## 📋 Sobre o Projeto

**EmpregosSTP** é a plataforma líder em São Tomé e Príncipe para conectar talentos e oportunidades de emprego. Desenvolvida com as mais modernas tecnologias web, oferece uma experiência intuitiva tanto para candidatos quanto para empresas.

### ✨ Principais Funcionalidades

- 🔍 **Busca Avançada** - Encontre vagas por cargo, empresa ou localização
- 👤 **Perfis Personalizados** - Para candidatos e empresas
- 💼 **Gestão de Vagas** - Publicação e gerenciamento simplificado
- 📊 **Dashboard Administrativo** - Controle total da plataforma
- 🎯 **Categorias Populares** - Navegue por área de interesse
- ⚡ **Candidaturas Rápidas** - Aplique com um clique
- 🌟 **Sistema Premium** - Destaque para vagas e perfis
- 📱 **Design Responsivo** - Funciona em todos os dispositivos

---

## 🎨 Design System

O EmpregosSTP utiliza um sistema de design moderno e profissional:

### Paleta de Cores

- **Azul Escuro**: `#0c1e47` → `#1e3a8a` → `#1e40af` (Gradiente principal)
- **Verde**: `#10b981` → `#059669` (Secundário)
- **Cinza**: `#f8fafc` → `#64748b` (Neutro)

Para mais detalhes, consulte [DESIGN-COLORS.md](./DESIGN-COLORS.md)

---

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Next.js 15.3.4** - Framework React com SSR
- **React 19.1.0** - Biblioteca JavaScript
- **React Icons** - Ícones modernos

### Backend & Database
- **Firebase 11.10.0** - Authentication & Firestore
- **Firebase Admin** - Servidor e administração

### Estilização
- **CSS Modules** - Estilos isolados por componente
- **CSS Global** - Sistema de design consistente

---

## 🚀 Como Executar o Projeto

### Pré-requisitos

- Node.js 18+ instalado
- NPM ou Yarn
- Conta Firebase configurada

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/seu-usuario/empregostp.git
cd empregostp
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Firebase Config (Frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin (Backend - Vercel)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n.....\n-----END PRIVATE KEY-----\n"
```

4. **Execute o projeto**

```bash
npm run dev
```

O projeto estará disponível em `http://localhost:3000`

---

## 📂 Estrutura do Projeto

```
empregostp/
├── components/          # Componentes React reutilizáveis
│   ├── ads/            # Sistema de anúncios
│   ├── home/           # Componentes da homepage
│   ├── JobCard.js      # Card de vaga
│   └── LandingHeader.js # Header principal
├── context/            # Context API (Auth)
├── lib/                # Configurações e utilitários
│   ├── firebase.js     # Config Firebase Client
│   └── firebaseAdmin.js # Config Firebase Admin
├── pages/              # Páginas Next.js
│   ├── api/            # API Routes
│   ├── dashboard/      # Dashboards (Admin, Empresa, Candidato)
│   ├── index.js        # Homepage
│   └── vagas/          # Listagem de vagas
├── public/             # Arquivos estáticos
├── styles/             # Estilos globais e módulos
└── scripts/            # Scripts utilitários
```

---

## 👥 Tipos de Usuário

### 🎓 Candidatos
- Criar perfil profissional
- Buscar e filtrar vagas
- Candidatar-se a oportunidades
- Gerenciar aplicações

### 🏢 Empresas
- Publicar vagas de emprego
- Gerenciar candidaturas
- Buscar candidatos qualificados
- Planos premium disponíveis

### 👨‍💼 Administradores
- Gerenciar usuários
- Aprovar/rejeitar vagas
- Gerenciar planos premium
- Análise e relatórios

---

## 📱 Screenshots

### Homepage
![Homepage](./public/readme.png)

*Design moderno com busca intuitiva e vagas em destaque*

---

## 🔐 Segurança

- ✅ Autenticação Firebase
- ✅ Variáveis de ambiente protegidas
- ✅ Credenciais não versionadas
- ✅ Validação de dados no servidor
- ✅ Proteção de rotas administrativas

---

## 📈 Roadmap

- [ ] Sistema de notificações em tempo real
- [ ] Chat entre candidatos e empresas
- [ ] Integração com LinkedIn
- [ ] App mobile (React Native)
- [ ] Sistema de recomendações com IA
- [ ] Testes de habilidades
- [ ] Videoconferências integradas

---

## 🤝 Como Contribuir

1. Faça um Fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença ISC.

---

## 👨‍💻 Autor

**Edmir dos Santos**

- GitHub: [@edmir](https://github.com/seu-usuario)
- Email: seu-email@exemplo.com

---

## 🙏 Agradecimentos

- Comunidade Next.js
- Firebase Team
- Todos os colaboradores

---

<div align="center">
  
  ### ⭐ Se este projeto te ajudou, considere dar uma estrela!
  
  **EmpregosSTP** - Conectando Talentos ao Sucesso 🚀
  
  Made with ❤️ in São Tomé e Príncipe
  
</div>



para empresa incluir esses servicos: Vagas em destaque na homepage
Vagas no topo dos resultados de pesquisa
Selo “Empresa em recrutamento”
Campanhas promocionais da vaga por email
Divulgação em redes sociais da plataforma
Notificações push para candidatos compatíveis
Destaque visual da marca da empresa
Página empresarial personalizada,Pré-filtragem automática de candidatos
Perguntas eliminatórias na candidatura
Matching CV-vaga
Ranking automático de candidatos
Testes técnicos ou psicométricos integrados
Vídeo-apresentação do candidato
Agendamento de entrevistas
Shortlist automática
Rejeição automática de perfis sem critérios mínimos,Perfil institucional avançado
Página com cultura, missão, benefícios e ambiente
Upload de fotos e vídeos da empresa
Depoimentos de colaboradores
Selo de empresa verificada
Página de carreiras personalizada
Publicação de artigos ou conteúdos da empresa no blog da plataforma,Tempo médio até contratação
Origem dos candidatos
Perfil mais comum dos candidatos
Comparação entre vagas/publicações
Relatórios exportáveis
Recomendações para melhorar anúncios,Alertas automáticos quando surge candidato ideal
Respostas automáticas aos candidatos
Pipeline tipo ATS: recebido, em análise, entrevista, aprovado, rejeitado
Templates de mensagens
Integração com email
Integração com calendário para entrevistas
Exportação de candidatos em PDF/Excel
Multiutilizador para RH da mesma empresa,Verificação da empresa
Verificação documental
Selo anti-fraude
Moderação de vagas
Apoio prioritário
Auditoria de anúncios suspeitos
Controlo de acessos por equipa, Criação profissional do anúncio da vaga
Apoio na definição do perfil ideal
Curadoria manual de candidatos
Headhunting para posições específicas
Campanhas de recrutamento dedicadas
Consultoria de recrutamento
Apoio à contratação em massa,Recomendação por IA de candidatos
Escrita assistida de descrições de vagas
Benchmark salarial por função
Talent pool privado
Talent rediscovery: reaproveitar antigos candidatos
Recrutamento para estágios
Recrutamento para freelancers
Recrutamento por projeto
Programa de referral interno
Landing pages de campanhas de recrutamento
# EmpregoSTP-white
