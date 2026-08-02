> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

# Implementação de Vagas em Destaque

## Visão Geral
Sistema completo de vagas em destaque (featured jobs) com visual diferenciado, filtros, ordenação prioritária e uma seção dedicada na homepage.

## Componentes Implementados

### 1. **JobCard Component** (`/components/JobCard.js`)
- **Estilo Visual para Destaques:**
  - Gradiente de fundo: laranja (#fb923c) para azul (#3b82f6)
  - Borda laranja 2px com transparência
  - Sombra laranja glowing (box-shadow)
  - Efeito hover elevado (+8px de translateY)
  
- **Badge de Destaque:**
  - Posicionado no canto superior direito
  - Fundo gradiente laranja/vermelho
  - Ícone de estrela (⭐) + texto "Em Destaque"
  - Bordas arredondadas especiais (0 26px 0 16px)
  - Sombra laranja 4px

- **CSS Classes:**
  ```css
  .job-card.featured { ... }
  .job-card.featured:hover { ... }
  .featured-badge { ... }
  ```

### 2. **Homepage** (`/pages/index.js`)
- **Seção "Vagas em Destaque":**
  - Renderização condicional: `{filteredJobs.some(job => job.destaque) && (...)}`
  - Contêiner com fundo gradiente
  - Título com ícone de estrela
  - Exibe até 3 vagas em destaque
  - Ordenação automática (destaques aparecem primeiro)

- **Sort Logic:**
  - Vagas em destaque vêm sempre no topo
  - Depois ordenadas por data (mais recentes)
  - Implementado em: `sort((a, b) => { if (a.destaque && !b.destaque) return -1; ... })`

### 3. **Página de Vagas** (`/pages/vagas/index.js`)

#### Estado de Filtros
```javascript
const [filters, setFilters] = useState({
  localizacao: '',
  tipoContrato: '',
  status: '',
  showFeatured: false, // ← NOVO
});
```

#### Lógica de Filtro
```javascript
if (filters.showFeatured) {
  result = result.filter(job => 
    job.destaque === true || 
    job.featured === true || 
    job.isFeatured === true
  );
}
```

#### UI Checkbox
- Label estilizado com cor laranja quando ativo
- Checkbox com `accentColor: '#fb923c'`
- Background dinâmico: `rgba(251, 146, 60, 0.1)` quando ativo
- Borda dinâmica: `rgba(251, 146, 60, 0.4)` quando ativo
- Texto: "⭐ Apenas Destaques"

#### Active Filter Chips
```javascript
filters.showFeatured ? '⭐ Apenas Destaques' : null,
```

### 4. **Ordenação Prioritária**
Implementada em 3 tipos de sort:

**Recentes:**
```javascript
if (sortBy === 'recentes') {
  result.sort((a, b) => {
    if (a.destaque && !b.destaque) return -1;
    if (!a.destaque && b.destaque) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
}
```

**Prazo de Candidatura:**
```javascript
if (a.destaque && !b.destaque) return -1;
if (!a.destaque && b.destaque) return 1;
return new Date(a.dataFecho || '9999-12-31') - new Date(b.dataFecho || '9999-12-31');
```

**Maior Salário:**
```javascript
if (a.destaque && !b.destaque) return -1;
if (!a.destaque && b.destaque) return 1;
return parseFloat(b.salarioAte || 0) - parseFloat(a.salarioAte || 0);
```

## Regras Visuais

### Cores Utilizadas
- **Destaque Principal:** `#fb923c` (Laranja)
- **Destaque Secundário:** `#f97316` (Laranja escuro)
- **Gradiente:** 135deg, #fb923c → #f97316
- **Transparências:** 0.08, 0.1, 0.15, 0.2, 0.3, 0.4

### Espaçamentos
- Badge padding: `0.5rem 1rem`
- Label checkbox padding: `0.75rem 1rem`
- Border-radius: `12px` (normal), `26px` (arredondado), `0 26px 0 16px` (badge)

### Efeitos Hover
- **JobCard:** Elevação de 8px, sombra laranja 0 30px 70px
- **Checkbox Label:** Transição de cores 0.3s
- **Badge:** Sombra sempre visível

## Dados Necessários

A implementação verifica 3 campos possíveis para identificar vagas em destaque:
- `job.destaque` (recomendado)
- `job.featured` (alternativo)
- `job.isFeatured` (alternativo)

## Funcionalidades

✅ **Filtro "Apenas Destaques"** - Checkbox na página /vagas
✅ **Visual Diferenciado** - Badge, gradiente, borda, sombra
✅ **Ordenação Automática** - Destaques sempre no topo
✅ **Seção Dedicada** - Homepage com "Vagas em Destaque"
✅ **Responsive** - Funciona em mobile e desktop
✅ **Active Filter Chips** - Mostra filtro ativo
✅ **Clear Filters** - Limpa o filtro de destaques
✅ **Contador** - Stats mostra total de vagas em destaque

## Fluxo de Usuário

1. **Acesso à Homepage (`/`):**
   - Se houver vagas em destaque, seção "Vagas em Destaque" aparece
   - Mostra até 3 primeiras vagas destacadas
   - Todas ordenadas com destaques no topo

2. **Acesso à Página de Vagas (`/vagas`):**
   - Checkbox "⭐ Apenas Destaques" disponível
   - Ativando o checkbox, filtra para mostrar apenas vagas destacadas
   - Ordenação respeita prioridade de destaques
   - Filter chip aparece no topo indicando filtro ativo

3. **Visualização Individual:**
   - Vagas com destaque mostram badge no canto superior direito
   - Estilo visual diferenciado (borda, gradiente, sombra)
   - Hover intensificado

## Testagem Recomendada

```
1. Homepage:
   - Verificar se seção "Vagas em Destaque" aparece
   - Confirmar que mostra até 3 vagas
   - Testar em mobile/desktop

2. Página /vagas:
   - Ativar/desativar checkbox "Apenas Destaques"
   - Verificar filtragem funciona
   - Testar com outras combinações de filtros
   - Confirmar sort respeita prioridade

3. JobCard:
   - Verificar badge aparece e está bem posicionado
   - Testar hover effects
   - Testar responsividade

4. Performance:
   - Verificar renderização com muitas vagas
   - Testar transições de estado
```

## Integração com Dashboard de Empresa

O sistema se integra com `/pages/dashboard/empresa/vagas.js` onde empresas podem:
- Ativar/desativar destaque (botão "Destacar")
- Ver limite de destaques por plano
- Acompanhar quantas vagas estão em destaque
- API endpoint: `PATCH /api/jobs/[id]/destaque`

## Estrutura de Dados Esperada

```javascript
{
  id: "job-id",
  titulo: "Desenvolvedor React",
  empresaNome: "Tech Company",
  localizacao: "São Tomé",
  salarioDe: 50000,
  salarioAte: 70000,
  tipoContrato: "full-time",
  status: "active",
  destaque: true, // Campo utilizado para destaque
  createdAt: "2024-01-15T10:00:00Z",
  // ... outros campos
}
```

## Notas de Implementação

- Filtro `showFeatured` é **opcional** e não obrigatório
- Sistema funciona mesmo sem nenhuma vaga em destaque
- Compatível com todos os tipos de contrato e localização
- Sort logic garante que destaques aparecem sempre primeiro
- Sem impacto na performance (filtros simples)
