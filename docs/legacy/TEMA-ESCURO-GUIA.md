> **OBSOLETO — não reflete o estado atual do projeto.**
> Arquivado na auditoria de release de agosto de 2026. Mantido apenas como
> registo histórico. As fontes de verdade são o `README.md`, o
> `DESIGN-SYSTEM.md`, o `docs/DEPLOY-GUIDE.md` e o relatório em
> `docs/audits/release-audit-2026-08.md`.

# 🌙 Guia do Tema Escuro - EmpregosSTP

## 🎨 Paleta de Cores do Tema Escuro

### **Backgrounds Escuros**
```css
/* Muito Escuro */
--bg-dark-base: #0a0e1a;

/* Escuro Médio */
--bg-dark-mid: #0f1420;

/* Escuro Claro */
--bg-dark-light: #1a1f35;

/* Escuro Suave */
--bg-dark-soft: #252b47;
```

### **Cores de Accent (Destaques)**

#### Azul (Principal)
```css
--blue-light: #60a5fa;  /* Texto em fundos escuros */
--blue-base: #3b82f6;   /* Primário */
--blue-dark: #2563eb;   /* Gradientes */
```

#### Verde (Secundário)
```css
--green-light: #34d399; /* Texto em fundos escuros */
--green-base: #10b981;  /* Primário */
--green-dark: #059669;  /* Gradientes */
```

#### Roxo (Terciário)
```css
--purple-light: #818cf8; /* Texto em fundos escuros */
--purple-base: #6366f1;  /* Primário */
--purple-dark: #4f46e5;  /* Gradientes */
```

---

## 📝 Contraste de Textos (WCAG AAA)

### **Texto em Fundos Escuros**

| Tipo | Cor | Opacidade | Uso |
|------|-----|-----------|-----|
| **Título Principal** | `white` | 100% | Títulos H1, H2 |
| **Texto Primário** | `white` | 90% | Texto importante |
| **Texto Secundário** | `white` | 80% | Descrições |
| **Texto Terciário** | `white` | 70% | Legendas |
| **Texto Desabilitado** | `white` | 50-60% | Textos auxiliares |

### **Exemplos de Uso**

```jsx
// Título Principal
<h1 style={{ color: 'white' }}>Título</h1>

// Texto Importante
<p style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Texto</p>

// Descrição
<p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Descrição</p>

// Legenda
<span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Legenda</span>

// Auxiliar
<small style={{ color: 'rgba(255, 255, 255, 0.6)' }}>Info</small>
```

---

## 🔲 Glassmorphism (Vidro Fosco)

### **Cards com Efeito Vidro**

```jsx
{
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(10px)',
  border: '2px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
}
```

### **Variações de Intensidade**

| Intensidade | Background | Border | Uso |
|-------------|------------|--------|-----|
| **Suave** | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.1)` | Cards padrão |
| **Média** | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.15)` | Hover states |
| **Forte** | `rgba(255,255,255,0.12)` | `rgba(255,255,255,0.2)` | Elementos ativos |

---

## 🎯 Gradientes

### **Backgrounds de Seções**

```css
/* Hero */
background: linear-gradient(135deg, #0a0e1a 0%, #1a1f35 50%, #252b47 100%);

/* Transição Superior */
background: linear-gradient(180deg, #252b47 0%, #1a1f35 100%);

/* Transição Inferior */
background: linear-gradient(180deg, #0f1420 0%, #1a1f35 100%);

/* Alternado */
background: linear-gradient(180deg, #1a1f35 0%, #0f1420 100%);
```

### **Botões e Elements**

```css
/* Azul */
background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
/* Hover */ background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);

/* Verde */
background: linear-gradient(135deg, #10b981 0%, #059669 100%);
/* Hover */ background: linear-gradient(135deg, #34d399 0%, #10b981 100%);

/* Roxo */
background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
/* Hover */ background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
```

---

## ✨ Elementos Decorativos

### **Blobs de Gradiente**

```jsx
<div style={{
  position: 'absolute',
  width: '500px',
  height: '500px',
  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)',
  borderRadius: '50%',
  filter: 'blur(100px)',
  pointerEvents: 'none'
}}></div>
```

**Cores dos Blobs:**
- Azul: `rgba(59, 130, 246, 0.08-0.15)`
- Verde: `rgba(16, 185, 129, 0.06-0.15)`
- Roxo: `rgba(99, 102, 241, 0.06-0.12)`

---

## 🎭 Estrutura de Seções

```
┌─────────────────────────────────────┐
│ Header (Semi-transparente escuro)   │
├─────────────────────────────────────┤
│ Hero (#0a0e1a → #252b47)           │
├─────────────────────────────────────┤
│ Statistics (#252b47 → #1a1f35)     │
├─────────────────────────────────────┤
│ Vagas (#0f1420 → #1a1f35)          │
├─────────────────────────────────────┤
│ Categorias (#1a1f35 → #0f1420)     │
├─────────────────────────────────────┤
│ Como Funciona (#0f1420 → #1a1f35)  │
├─────────────────────────────────────┤
│ CTA (#0a0e1a → #252b47)            │
├─────────────────────────────────────┤
│ Footer (#0a0e1a → #1a1f35)         │
└─────────────────────────────────────┘
```

**Padrão**: Gradientes alternados criando transições suaves! ✨

---

## 💫 Efeitos de Hover

### **Cards Glassmorphism**

```jsx
// Estado Normal
{
  background: 'rgba(255, 255, 255, 0.05)',
  border: '2px solid rgba(255, 255, 255, 0.1)',
  transform: 'translateY(0)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
}

// Estado Hover
{
  background: 'rgba(255, 255, 255, 0.08)',
  border: '2px solid #3b82f6', // Cor do tema
  transform: 'translateY(-8px)',
  boxShadow: '0 12px 35px rgba(59, 130, 246, 0.4)'
}
```

### **Botões**

```jsx
// Normal
background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'

// Hover
background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
transform: 'translateY(-3px)'
```

---

## 🔍 Checklist de Contraste

### ✅ Aprovado (WCAG AAA)

- ✅ Branco em `#0a0e1a` - Ratio: 18.6:1
- ✅ Branco (90%) em `#0a0e1a` - Ratio: 16.7:1
- ✅ Branco (80%) em `#1a1f35` - Ratio: 13.2:1
- ✅ `#60a5fa` em `#0a0e1a` - Ratio: 8.1:1
- ✅ `#34d399` em `#0a0e1a` - Ratio: 9.2:1

### ⚠️ Evitar

- ❌ Cinza claro (#cbd5e1) em fundos escuros - Baixo contraste
- ❌ Texto com opacidade < 60% para conteúdo importante
- ❌ Cores escuras em fundos escuros

---

## 🎨 Componentes do Tema

### **Header**
- Background: `rgba(10, 14, 26, 0.95)` + blur(20px)
- Links: `rgba(255, 255, 255, 0.8)`
- Hover: `#60a5fa`
- Botão: Gradiente azul

### **Cards de Vagas**
- Background: `rgba(255, 255, 255, 0.05)` + blur(10px)
- Título: `white`
- Texto: `rgba(255, 255, 255, 0.8)`
- Descrição: `rgba(255, 255, 255, 0.7)`
- Badge "ABERTA": `#d1fae5` com texto `#065f46`
- Botão: Gradiente azul vibrante

### **Statistics Cards**
- Background: Semi-transparente colorido + blur
- Números: Gradiente colorido
- Texto: `rgba(255, 255, 255, 0.9)`

### **Footer**
- Background: Gradiente escuro
- Título: Gradiente azul → verde
- Textos: `rgba(255, 255, 255, 0.7-0.8)`
- Links hover: Cores temáticas

---

## 📱 Responsividade

O tema escuro mantém todas as características responsivas:

```css
@media (max-width: 768px) {
  /* Todos os espaçamentos e cores se mantêm */
  /* Glassmorphism se mantém */
  /* Gradientes se adaptam */
}
```

---

## 🚀 Performance

### **Otimizações Aplicadas**

1. ✅ **Blur moderado**: `blur(10px-20px)` para melhor performance
2. ✅ **Gradientes CSS**: Nativo, sem imagens
3. ✅ **Transitions suaves**: `0.3s ease` universal
4. ✅ **Hardware acceleration**: `transform` em vez de `top/left`

---

## 💡 Boas Práticas

### **✅ Fazer**

- Use `rgba(255, 255, 255, 0.X)` para textos
- Use glassmorphism em cards sobre fundos escuros
- Mantenha consistência nos gradientes
- Use cores vibrantes (#60a5fa) para destaques
- Teste contraste em https://webaim.org/resources/contrastchecker/

### **❌ Evitar**

- Texto cinza escuro em fundos escuros
- Múltiplos blurs em elementos sobrepostos
- Gradientes muito complexos
- Opacidade < 60% em textos importantes
- Misturar temas claro/escuro

---

**Criado para EmpregosSTP** 🌙  
Design de nível corporativo internacional  
Última atualização: 2025










