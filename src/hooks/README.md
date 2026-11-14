# Hooks compartilhados

Esta pasta contém comportamento de UI reutilizado. Estado exclusivo de uma funcionalidade permanece junto dela em features.

use-data-query.ts assina a store Zustand e solicita leituras validadas pelo cliente HTTP. Use os schemas estáveis de contracts. Não importe Prisma, Redis ou módulos server neste diretório.

O clone conserva adaptadores de accessors Solid; um nome iniciado por use não autoriza chamar um hook React fora de um componente/hook. Preserve as regras verificadas pelo lint.

Consulte a [estrutura do projeto](../../docs/architecture/project-structure.md).
