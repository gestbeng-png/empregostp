# Sistema de Design - empregoSTP

Este documento descreve o sistema de design implementado para o projeto empregoSTP, incluindo variáveis CSS, componentes e padrões de estilo.

## Variáveis CSS

O projeto utiliza variáveis CSS para facilitar a manutenção e consistência do design. Estas variáveis estão definidas no arquivo `styles/globals.css`.

### Cores

```css
/* Cores principais */
--color-primary: #63b3ed;      /* Azul principal */
--color-primary-dark: #4299e1; /* Azul escuro */
--color-secondary: #4a5568;    /* Cinza escuro */
--color-secondary-dark: #2d3748; /* Cinza mais escuro */

/* Cores de fundo */
--color-bg-dark: #1a202c;      /* Fundo escuro (principal) */
--color-bg-medium: #2d3748;    /* Fundo médio (formulários) */
--color-bg-light: #4a5568;     /* Fundo claro (elementos) */

/* Cores de texto */
--color-text-light: #edf2f7;   /* Texto claro */
--color-text-medium: #a0aec0;  /* Texto médio */
--color-text-dark: #718096;    /* Texto escuro */
```

### Espaçamento

```css
--spacing-xs: 0.5rem;   /* 8px */
--spacing-sm: 0.75rem;  /* 12px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
--spacing-xxl: 3rem;    /* 48px */
```

### Bordas

```css
--border-radius-sm: 4px;
--border-radius-md: 5px;
--border-radius-lg: 8px;
--border-radius-xl: 12px;
```

### Transições

```css
--transition-fast: 0.2s ease;
--transition-normal: 0.3s ease;
--transition-slow: 0.5s ease;
```

## Componentes

### Botões

O sistema inclui vários estilos de botões:

- `.btn-primary`: Botão azul com texto escuro
- `.btn-secondary`: Botão cinza com texto claro
- `.btn-primary-outline`: Botão transparente com borda azul
- `.btn-lg`: Modificador para botões maiores

### Cartões de Vagas

Os cartões de vagas usam as seguintes classes:

- `.vagas-grid`: Grid para layout de cartões
- `.vaga-card`: Cartão individual de vaga
- `.vaga-card-header`: Cabeçalho do cartão
- `.vaga-card-badge`: Badge de status ou tipo
- `.vaga-card-body`: Corpo do cartão
- `.vaga-card-salary`: Informação de salário
- `.vaga-card-company`: Informações da empresa

### Layout Circular

A página inicial usa um layout circular com:

- `.home-circle-layout`: Container principal
- `.central-circle`: Círculo central com conteúdo
- `.floating-job-cards`: Cartões flutuantes ao redor
- `.search-container`: Barra de pesquisa central

### Painéis de Tipo de Usuário

A seção de candidato/empregador usa:

- `.user-type-section`: Container principal
- `.user-type-panel`: Painel individual
- `.user-type-panel.candidate`: Painel azul para candidatos
- `.user-type-panel.employer`: Painel verde para empregadores

## Boas Práticas

1. **Use as variáveis CSS** sempre que possível em vez de valores hardcoded
2. **Mantenha a consistência** usando os componentes existentes
3. **Responsividade** é implementada com media queries em cada componente
4. **Acessibilidade** é considerada com contraste adequado e foco visível

## Extensão do Sistema

Ao adicionar novos componentes:

1. Siga o padrão de nomenclatura existente
2. Use as variáveis CSS para cores, espaçamento e bordas
3. Implemente versões responsivas
4. Documente o novo componente neste arquivo



Email: edmir@emprego.st
Senha: 123456
UID: I71Og7to44h1R0zjJXT9z0HR5Cn2