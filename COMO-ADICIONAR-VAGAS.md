# Como Adicionar Vagas no Firebase

## Estrutura dos Dados das Vagas

Para que as vagas apareçam corretamente nos cards com todas as informações da imagem, elas devem ter a seguinte estrutura no Firebase Firestore:

### Collection: `jobs`

```javascript
{
  // CAMPOS OBRIGATÓRIOS
  "titulo": "Motorista",                          // Título da vaga
  "localizacao": "Água Grande",                   // Cidade/Local
  "tipoContrato": "Estágio",                      // Tipo: Estágio, Contrato, Freelance, Tempo Integral, Meio Período
  "status": "active",                             // Status da vaga (active = ABERTA)
  
  // CAMPOS DE SALÁRIO
  "salarioDe": "8000.00",                         // Salário mínimo em Dobras
  "salarioAte": "9000.00",                        // Salário máximo em Dobras (opcional)
  
  // CAMPOS DE DESCRIÇÃO
  "experiencia": "2 anos de experiência",         // Experiência necessária
  "descricao": "Descrição completa da vaga...",  // Descrição longa
  "requisitos": [                                 // Array de requisitos
    "Requisito 1",
    "Requisito 2",
    "Requisito 3"
  ],
  
  // CAMPO DE PRAZO
  "prazo": "2025-10-30",                          // Data limite em formato YYYY-MM-DD
  
  // CAMPOS DA EMPRESA
  "companyId": "ID_DA_EMPRESA",                   // ID do documento da empresa
  "empresaNome": "Nome da Empresa",               // Nome da empresa (opcional, pega do companyId)
  
  // CAMPOS OPCIONAIS
  "remoto": false,                                // true = trabalho remoto
  "destaque": false,                              // true = vaga em destaque
  
  // CAMPOS DE TIMESTAMP (gerenciados automaticamente)
  "createdAt": FIREBASE_TIMESTAMP,
  "updatedAt": FIREBASE_TIMESTAMP,
  "publicadoEm": FIREBASE_TIMESTAMP
}
```

## Exemplos de Vagas (Baseado na Imagem)

### Exemplo 1: Motorista
```javascript
{
  "titulo": "Motorista",
  "localizacao": "Água Grande",
  "tipoContrato": "Estágio",
  "salarioDe": "8000.00",
  "salarioAte": "9000.00",
  "experiencia": "2 anos de experiência",
  "prazo": "2025-10-30",
  "status": "active",
  "remoto": false,
  "destaque": false,
  "companyId": "ID_DA_EMPRESA"
}
```

### Exemplo 2: Design
```javascript
{
  "titulo": "Design",
  "localizacao": "São Tomé",
  "tipoContrato": "Estágio",
  "salarioDe": "100.00",
  "experiencia": "Ser design profissional",
  "prazo": "2025-11-08",
  "status": "active",
  "remoto": false,
  "destaque": false,
  "companyId": "ID_DA_EMPRESA"
}
```

### Exemplo 3: Pedreiro
```javascript
{
  "titulo": "Pedreiro",
  "localizacao": "São Tomé",
  "tipoContrato": "Contrato",
  "salarioDe": "10000.00",
  "salarioAte": "14997.00",
  "experiencia": "Saber construir uma casa de madeira",
  "prazo": "2025-10-23",
  "status": "active",
  "remoto": false,
  "destaque": false,
  "companyId": "ID_DA_EMPRESA"
}
```

### Exemplo 4: Vender Peixe
```javascript
{
  "titulo": "Vender Peixe",
  "localizacao": "Neves",
  "tipoContrato": "Freelance",
  "experiencia": "Ser bom vendedor",
  "prazo": "2025-08-28",
  "status": "active",
  "remoto": false,
  "destaque": false,
  "companyId": "ID_DA_EMPRESA"
}
```

### Exemplo 5: Web design
```javascript
{
  "titulo": "Web design",
  "localizacao": "Neves",
  "tipoContrato": "Contrato",
  "salarioDe": "1000.00",
  "salarioAte": "1500.00",
  "experiencia": "Saber canva, photoshop e Lightroom",
  "prazo": "2025-07-31",
  "status": "active",
  "remoto": false,
  "destaque": false,
  "companyId": "ID_DA_EMPRESA"
}
```

### Exemplo 6: Carpinteiro
```javascript
{
  "titulo": "Carpinteiro",
  "localizacao": "Neves",
  "tipoContrato": "Tempo Integral",
  "salarioDe": "1000.00",
  "salarioAte": "4000.00",
  "experiencia": "Ter martelo",
  "prazo": "2025-07-15",
  "status": "active",
  "remoto": false,
  "destaque": false,
  "companyId": "ID_DA_EMPRESA"
}
```

## Tipos de Contrato Aceitos

Os seguintes valores são aceitos para o campo `tipoContrato`:

- `"Tempo Integral"` ou `"full-time"`
- `"Meio Período"` ou `"part-time"`
- `"Contrato"` ou `"contract"`
- `"Estágio"` ou `"internship"` ou `"estagio"`
- `"Freelance"` ou `"freelance"`

## Como Adicionar no Firebase Console

1. Acesse o Firebase Console: https://console.firebase.google.com
2. Selecione seu projeto
3. Vá em **Firestore Database**
4. Clique na collection `jobs` (ou crie se não existir)
5. Clique em **Add Document**
6. Cole a estrutura JSON com os dados da vaga
7. Clique em **Save**

## Campos que Aparecem no Card

Baseado na imagem, os cards mostram:

1. ✅ **Badge "ABERTA"** - Aparece quando `status === "active"`
2. ✅ **Título** - Campo `titulo`
3. ✅ **Localização** - Campo `localizacao` (com ícone de pin)
4. ✅ **Tipo de Contrato** - Campo `tipoContrato` (com ícone de calendário)
5. ✅ **Experiência/Requisito** - Campo `experiencia` ou primeiro item de `requisitos`
6. ✅ **Salário** - Campos `salarioDe` e `salarioAte` (formato: "X,XX Db - Y,YY Db")
7. ✅ **Prazo** - Campo `prazo` (formato: "Prazo: DD/MM/YYYY")
8. ✅ **Botão "Ver Detalhes"** - Link para `/vaga/[id]`

## Observações Importantes

- O salário deve ser em **Dobras (Db)**
- A data de prazo deve estar no formato **YYYY-MM-DD** ou **DD/MM/YYYY**
- O status `"active"` fará aparecer o badge verde **"ABERTA"**
- Todos os campos são opcionais exceto: `titulo`, `localizacao`, `tipoContrato` e `status`
- Se o salário não for informado, não aparecerá no card
- Se a experiência não for informada, tentará pegar o primeiro requisito ou a descrição

## Formato dos Números

- **Salário**: Use formato com ponto decimal: `"8000.00"` ou `"8000"`
- **Data**: Use formato ISO: `"2025-10-30"` ou `"30/10/2025"`

## Status das Vagas

- `"active"` ou `"open"` - Vaga aberta (badge verde "ABERTA")
- `"closed"` - Vaga fechada (sem badge)
- `"paused"` - Vaga pausada

## Dicas

1. Sempre preencha o campo `experiencia` para que apareça no card
2. Use valores realistas para os salários
3. Defina um prazo adequado para cada vaga
4. Mantenha o `status` como `"active"` para vagas abertas
5. Vincule sempre a vaga a uma empresa através do `companyId`










