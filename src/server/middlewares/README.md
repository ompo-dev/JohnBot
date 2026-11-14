# Middlewares HTTP

command-context.ts compõe validação da chave de idempotência, envelope JSON e leitura da sessão demo. Os parsers e helpers pertencem a server/http; a execução pertence a server/commands.

Esta pasta não é o proxy.ts global do Next e não substitui autenticação de produção. As portas UI/IPC continuam em src/middlewares.

Consulte [fronteiras](../../../docs/architecture/project-structure.md#middlewares-http-e-uiipc).
