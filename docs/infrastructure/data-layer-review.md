# Revisão da continuação — 2026-11-12

A continuação gratuita do DeepSeek parou com HTTP 429 (`provider.free-limit`). Nenhum modelo pago foi selecionado. A entrega segue parcial: conta, preferências, app info e uso estão integrados; as fases B–G do relatório continuam pendentes.

Correções revisadas: token por claim e Lua de comparação para finalizar/liberar idempotência sem sobrescrever outro executor; versionamento CAS no Redis para preservar atualizações entre processos; emissão dos eventos de autenticação após respostas remotas.

Validação: teste real em Redis isolado demonstrou que um executor cujo claim expirou não sobrescreve o resultado novo. Quatro processos preservaram as 12 atualizações e seus incrementos de versão. O teste está incluído na CI. `bun run check`, testes de URL e teste HTTP da camada de dados passaram. Build Docker e serviços Redis/web saudáveis foram verificados.

A idempotência continua limitada pelo TTL e não constitui transação entre efeito e resultado; não promete execução exatamente uma vez após expiração ou queda de processo. A infraestrutura do servidor permanece de demonstração, sem backend externo real. Consulte o relatório anterior para a lista das operações que ainda permanecem locais.