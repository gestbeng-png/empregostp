# Documentação

Esta pasta concentra a documentação do projeto por finalidade.

## Guias operacionais

- [Publicação e reversão](DEPLOY-GUIDE.md)
- [Configuração de email](email-brevo-zoho.md)
- [Ambiente de execução](closure/ENVIRONMENT.md)

## Arquitetura e produto

- [Regras de negócio e organização por camadas](regranegocio.md)
- [Modelo de verificação de candidatos](verification-model.md)

## Auditorias e histórico

- `audits/` — inventários, verificações e evidências operacionais.
- `audits/rollback/` — cópias de segurança das regras usadas para reversão.
- `closure/` — decisões e encerramentos de trabalhos técnicos.

Os ficheiros JSON em `audits/` são resultados gerados de auditorias. Não são configuração da aplicação nem devem ser editados manualmente.
