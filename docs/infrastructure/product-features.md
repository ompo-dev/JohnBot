# Funcionalidades temporariamente desabilitadas

`src/lib/product-features.ts` centraliza os switches `billing`, `payments` e `updates`.
Todos começam em `false`. Para reativar, alterar os switches correspondentes e reconstruir a aplicação Docker.
As implementações permanecem no repositório. A navegação, os painéis e os handlers de compra/atualização respeitam os switches.

# Dataset e workflow de paradas

Fonte fornecida pelo usuário: `Machine Downtime.csv`, copiada sem transformação para `public/datasets/machine-downtime.csv`.
SHA-256: `F24A3F6B6B24545E699976B0D739A142767047F23063679936E6792D9D2EB63D`.
São 2.500 registros, 16 colunas, três máquinas/linhas, 1.265 registros `Machine_Failure` e 1.235 `No_Machine_Failure`.

O workflow `wf-machine-downtime-csv` usa cinco nós: início, Bronze, Prata, Ouro e publicação.
Bronze preserva o CSV original e SHA-256. Prata padroniza datas ISO, nomes e sensores numéricos,
preserva ausências como null, separa inválidos e remove somente duplicatas exatas (com contagem auditável).
Ouro agrega frequência de falha por máquina, linha e mês e produz insights descritivos e relatório Markdown.
Ele é persistido ao carregar os workflows, inclusive nas sessões existentes. A fonte fica disponível em `/datasets/machine-downtime.csv`.

O campo `Downtime` é uma classificação; não informa duração da parada. Sem horas de operação e tempos de reparo, não permite calcular OEE, MTTR ou MTBF.
O comando `workflows.run-csv` executa este pipeline no servidor sem LLM e persiste as três camadas e o histórico no PostgreSQL.
Downloads por sessão: `/api/datasets/machine-downtime?run=<id>&layer=bronze|silver|gold|report`.
Outros workflows usam o simulador quando `workflowSimulation` está ativo; seus resultados indicam explicitamente simulação.
Agentes reais continuam exigindo um provedor. A proteção `NEXT_DEPLOYMENT_ID` renova assets por build e detecta divergências de versão em navegações Next.
