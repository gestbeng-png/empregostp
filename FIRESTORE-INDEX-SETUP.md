# Configuração de Índices do Firestore

## Problema
O Firestore requer um índice composto para consultas que filtram por múltiplos campos. A query que verifica candidaturas do mês atual precisa de um índice nos campos `candidateId` e `createdAt`.

## Solução Rápida (Recomendada)

### Opção 1: Usar o link direto do erro
O próprio erro do Firestore fornece um link para criar o índice automaticamente. Clique no link fornecido no erro:

```
https://console.firebase.google.com/v1/r/project/empregostp/firestore/indexes?create_composite=...
```

### Opção 2: Criar manualmente no Console do Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `empregostp`
3. Vá para **Firestore Database** → **Indexes**
4. Clique em **Create Index**
5. Configure:
   - **Collection ID**: `applications`
   - **Fields to index**:
     - Campo 1: `candidateId` (Ascending)
     - Campo 2: `createdAt` (Ascending)
   - **Query scope**: Collection
6. Clique em **Create**

### Opção 3: Deploy via Firebase CLI (se tiver instalado)

Se você tiver o Firebase CLI instalado e configurado:

```bash
firebase deploy --only firestore:indexes
```

## Arquivo de Configuração

O arquivo `firestore.indexes.json` foi criado na raiz do projeto com a configuração necessária. Este arquivo pode ser usado para versionar os índices do Firestore.

## Tempo de Criação

Os índices compostos podem levar alguns minutos para serem criados. Você receberá um email quando o índice estiver pronto.

## Verificação

Após criar o índice, tente candidatar-se a uma vaga novamente. O erro deve desaparecer.

