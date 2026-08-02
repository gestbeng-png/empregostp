> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

# 🎯 Guia de Uso: Vagas em Destaque

## Para Usuários Candidatos

### Ver Vagas em Destaque

#### 1. Na Homepage (`/`)
```
Você verá automaticamente uma seção chamada "Vagas em Destaque"
se houver vagas marcadas como destaque na plataforma.

Visual:
┌─────────────────────────────────────────┐
│ ⭐ Vagas em Destaque                     │
│                                         │
│ Confira as principais oportunidades    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🌟 Em Destaque                      │ │
│ │                                     │ │
│ │ Desenvolvedor React Sênior          │ │
│ │ Tech Company                        │ │
│ │ São Tomé • Tempo Integral           │ │
│ │                                     │ │
│ │ [Ver Vaga] [Salvar]                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ (Até 3 vagas em destaque aparecem)      │
└─────────────────────────────────────────┘
```

#### 2. Na Página de Vagas (`/vagas`)
```
Você pode filtrar para ver APENAS vagas em destaque.

a) Procure pelo checkbox "⭐ Apenas Destaques"
   Localização: Acima da ordenação (lado esquerdo)

b) Clique no checkbox:
   ☐ ⭐ Apenas Destaques  →  ☑ ⭐ Apenas Destaques
   (Fundo muda para laranja quando ativo)

c) A página filtrará automaticamente para mostrar
   apenas vagas com destaque

d) Acima da lista, verá um chip mostrando:
   [X] ⭐ Apenas Destaques
   (Clique no X para remover o filtro)
```

#### 3. Identificando Vagas em Destaque
```
Cada vaga em destaque terá:

1. Badge no canto superior direito:
   ┌────────────────────┐
   │ ⭐ Em Destaque     │  ← Laranja/vermelho
   └────────────────────┘

2. Card diferenciado:
   - Borda laranja (2px)
   - Fundo com gradiente laranja/azul
   - Sombra laranja ao redor
   - Efeito hover especial (levanta mais)

3. Ordenação automática:
   - Sempre aparece antes de vagas normais
   - Mesmo ao ordenar por outras opções
```

---

## Para Usuários Empresa

### Ativar/Desativar Destaque de Vaga

#### No Dashboard (`/dashboard/empresa/vagas`)

```
1. Acesse seu Dashboard de Vagas
2. Na lista de vagas, procure pela coluna "Ações"
3. Clique em "Destacar" ou "⭐" (botão laranja)
4. A vaga será marcada como destaque:
   - Visível na homepage
   - Aparece no topo de /vagas
   - Mostra badge especial

5. Para remover destaque:
   - Clique novamente em "Destacar"
   - Ou na vaga, clique "Remover Destaque"

Limite de destaques por plano:
- Plano Gratuito: 0 destaques
- Plano Básico: 3 destaques
- Plano Premium: Ilimitado
```

---

## Visual Detalhado

### Badge de Destaque
```
┌─────────────────────────────────────────────────┐
│⭐ Em Destaque (no canto superior direito)       │
│                                                 │
│ Cores:                                          │
│ - Background: Gradiente #fb923c → #f97316     │
│ - Texto: Branco                                │
│ - Sombra: Laranja com 4px blur                │
│ - Font-weight: Muito peso (700)                │
└─────────────────────────────────────────────────┘
```

### Card JobCard em Destaque
```
┌─────────────────────────────────────────────────┐
│  ⭐ Em Destaque                                  │
│  ┌───────────────────────────────────────────┐  │
│  │ Background: Linear-gradient                 │  │
│  │ - 135deg de rgba(251,146,60,0.08)         │  │
│  │   para rgba(59,130,246,0.08)              │  │
│  │                                            │  │
│  │ Borda: 2px rgba(251,146,60,0.4) [laranja] │  │
│  │ Sombra: 0 0 30px rgba(251,146,60,0.15)    │  │
│  │                                            │  │
│  │ Hover:                                      │  │
│  │ - Levanta 8px                              │  │
│  │ - Sombra fica maior: 0 30px 70px          │  │
│  │ - Borda fica mais clara                    │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Checkbox de Filtro
```
Desativado (padrão):
┌─────────────────────────────────────────┐
│ ☐ ⭐ Apenas Destaques                   │
│   Background: rgba(255,255,255,0.05)   │
│   Texto: rgba(255,255,255,0.9)         │
│   Borda: rgba(255,255,255,0.1)         │
└─────────────────────────────────────────┘

Ativado:
┌─────────────────────────────────────────┐
│ ☑ ⭐ Apenas Destaques                   │
│   Background: rgba(251,146,60,0.1)     │
│   Texto: #fb923c (laranja)              │
│   Borda: rgba(251,146,60,0.4)          │
│   ✓ Checkbox com cor laranja            │
└─────────────────────────────────────────┘
```

---

## Fluxo Típico de Uso

### Cenário 1: Candidato vê vaga em destaque

```
1. Acessa homepage (/)
   ↓
2. Vê seção "Vagas em Destaque"
   ↓
3. Clica em "Ver Vaga" de uma vaga destacada
   ↓
4. Abre página detalhada da vaga
   ↓
5. Visualiza badge "⭐ Em Destaque" no JobCard
   ↓
6. Pode candidatar-se ou salvar a vaga
```

### Cenário 2: Candidato filtra apenas destaques

```
1. Acessa /vagas
   ↓
2. Procura checkbox "⭐ Apenas Destaques"
   ↓
3. Clica para ativar (muda para laranja)
   ↓
4. Lista filtra para mostrar apenas destaques
   ↓
5. Vê chip "⭐ Apenas Destaques" acima da lista
   ↓
6. Pode desativar clicando no X do chip
```

### Cenário 3: Empresa destaca uma vaga

```
1. Acessa /dashboard/empresa/vagas
   ↓
2. Procura vaga na lista
   ↓
3. Clica em "Destacar" (botão laranja)
   ↓
4. Vaga é marcada como destaque
   ↓
5. Sistema verifica limite do plano
   ↓
6. Se OK: vaga aparece em destaque por toda plataforma
   Se limite excedido: aviso de limite
```

---

## Troubleshooting

### Problema: Checkbox não aparece
**Solução:** Faça scroll para baixo na seção de filtros

### Problema: Vaga não aparece como destaque
**Solução:** Verifique se `destaque` está marcado como `true` no Firestore

### Problema: Badge não aparece
**Solução:** Confirme que o JobCard recebe a prop `destaque`

### Problema: Filtro não funciona
**Solução:** Recarregue a página (F5 ou Cmd+Shift+R)

---

## Combinações de Filtros

Você pode combinar o filtro de destaque com:
- ✅ Localização
- ✅ Tipo de Contrato
- ✅ Status da Vaga
- ✅ Busca por texto
- ✅ Ordenação (recentes, prazo, salário)

Exemplo:
```
São Tomé + Tempo Integral + Apenas Destaques + Maior Salário
= Vagas em destaque, tempo integral, em São Tomé, 
  ordenadas por maior salário
```

---

## Dicas e Truques

### 💡 Dica 1: Combinar Filtros
Filtre por localização + destaques para ver as melhores
oportunidades perto de você.

### 💡 Dica 2: Newsletter
Vagas em destaque geralmente têm melhores benefícios.
Fique atento a novas destaques!

### 💡 Dica 3: Salvar Vagas
Use o botão bookmark para salvar vagas em destaque
para depois.

### 💡 Dica 4: Compartilhar
Clique em "Compartilhar" em uma vaga em destaque
para enviar para um amigo.

---

**Última atualização:** 2024
**Versão:** 1.0
