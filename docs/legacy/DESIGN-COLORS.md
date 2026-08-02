> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

# 🎨 Guia de Cores - EmpregosSTP

## Cores Principais - Azul Escuro

### Gradiente Principal
```css
background: linear-gradient(135deg, #0c1e47 0%, #1e3a8a 50%, #1e40af 100%);
```

### Cores Sólidas

#### Azul Escuro (Principal)
- **Mais Escuro**: `#0c1e47` - Para fundos principais
- **Escuro**: `#1e3a8a` - Para elementos secundários
- **Médio**: `#1e40af` - Para destaques e botões

#### Verde (Secundário)
- **Principal**: `#10b981`
- **Escuro**: `#059669`
- **Claro**: `#34d399`

#### Cinza (Neutro)
- **Claro**: `#f8fafc` - Para fundos claros
- **Médio**: `#64748b` - Para texto secundário
- **Escuro**: `#475569` - Para texto principal

---

## Como Aplicar em Outras Páginas

### Método 1: Classes CSS (Recomendado)
```jsx
// Aplicar gradiente azul
<div className="bg-primary-gradient">
  Conteúdo aqui
</div>

// Aplicar azul escuro sólido
<div className="bg-primary-dark">
  Conteúdo aqui
</div>
```

### Método 2: Inline Styles
```jsx
// Hero Section
<section style={{
  background: 'linear-gradient(135deg, #0c1e47 0%, #1e3a8a 50%, #1e40af 100%)',
  padding: '6rem 0',
  color: 'white'
}}>
  Conteúdo aqui
</section>

// Fundo sólido
<div style={{
  backgroundColor: '#0c1e47',
  color: 'white'
}}>
  Conteúdo aqui
</div>
```

### Método 3: Variáveis CSS
```css
/* No seu arquivo CSS */
.minha-secao {
  background: var(--color-bg-blue-gradient);
  color: var(--color-text-white);
}
```

---

## Exemplos de Uso

### Header/Navigation
```jsx
<header style={{
  backgroundColor: '#f8fafc', // Cinza claro
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
}}>
```

### Hero Section
```jsx
<section style={{
  background: 'linear-gradient(135deg, #0c1e47 0%, #1e3a8a 50%, #1e40af 100%)',
  padding: '8rem 0',
  color: 'white'
}}>
```

### Footer
```jsx
<footer style={{
  background: 'linear-gradient(135deg, #0c1e47 0%, #1e3a8a 100%)',
  color: 'white'
}}>
```

### Botões
```jsx
// Botão Verde (Principal)
<button style={{
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: 'white',
  padding: '0.75rem 1.5rem',
  borderRadius: '12px'
}}>
  Clique Aqui
</button>

// Botão Azul
<button style={{
  background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
  color: 'white',
  padding: '0.75rem 1.5rem',
  borderRadius: '12px'
}}>
  Clique Aqui
</button>
```

### Cards
```jsx
<div style={{
  backgroundColor: 'white',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
}}>
  Conteúdo do card
</div>
```

---

## Combinações de Cores

### ✅ Boas Combinações

1. **Azul Escuro + Branco**
   - Fundo: `#0c1e47`
   - Texto: `#ffffff`
   - Uso: Headers, Footers, Hero Sections

2. **Branco + Verde**
   - Fundo: `#ffffff`
   - Botão: `#10b981`
   - Uso: CTAs, Formulários

3. **Cinza Claro + Azul**
   - Fundo: `#f8fafc`
   - Destaques: `#1e40af`
   - Uso: Seções de conteúdo

### ❌ Evitar

- Azul escuro + Verde escuro (pouco contraste)
- Cinza médio + Azul médio (pouco contraste)
- Texto cinza claro em fundo azul escuro (difícil de ler)

---

## Acessibilidade

### Contraste Mínimo (WCAG AA)
- ✅ Branco (#ffffff) em Azul Escuro (#0c1e47): Excelente
- ✅ Azul (#1e40af) em Branco (#ffffff): Bom
- ✅ Cinza Escuro (#475569) em Branco (#ffffff): Bom

### Dicas
- Use sempre texto branco em fundos azuis escuros
- Use texto escuro em fundos claros
- Teste o contraste em: https://webaim.org/resources/contrastchecker/

---

## Paleta Completa

```
Azul Escuro
━━━━━━━━━━━━━━━
#0c1e47 ███ Mais Escuro
#1e3a8a ███ Escuro
#1e40af ███ Médio
#3b82f6 ███ Claro

Verde
━━━━━━━━━━━━━━━
#059669 ███ Escuro
#10b981 ███ Principal
#34d399 ███ Claro

Cinza
━━━━━━━━━━━━━━━
#f8fafc ███ Ultra Claro
#cbd5e1 ███ Claro
#64748b ███ Médio
#475569 ███ Escuro
#0f172a ███ Muito Escuro
```

---

**Criado para EmpregosSTP** 🚀
Última atualização: 2025











