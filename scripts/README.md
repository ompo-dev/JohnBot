# Ferramentas de desenvolvimento e operação

Esta pasta contém entrypoints CLI de build, lint, checagem, estilos e utilitários do clone. db/import-redis.ts é a operação de migração de dados legados.

O código da aplicação permanece em src. O processo de longa duração fica em src/workers. Testes ficam em tests, com verificações específicas de hooks Git/CI ao lado de seus artefatos em .husky e .github.

check-architecture.mjs verifica imports e ciclos do núcleo de dados, usando o parser Bun instalado. A CI o executa como parte de `bun run check`. Rode comandos do package.json a partir da raiz do repositório.

Consulte [estrutura](../docs/architecture/project-structure.md) e [testes](../tests/README.md).
