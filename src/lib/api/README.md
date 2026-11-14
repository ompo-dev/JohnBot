# Cliente HTTP e adaptação do runtime

- client.ts: Axios, cancelamento, timeout, validação de respostas e comandos.
- errors.ts: erros do transporte no cliente.
- bridges/: integração dos contratos HTTP com eventos e APIs do runtime existente.
- mutations/: políticas que projetam uma alteração otimista por comando.

O estado fica em src/stores; o hook React fica em src/hooks/use-data-query.ts. Esta camada não importa backend ou conexões de banco. Não acrescente regras de persistência aos bridges.

Consulte [estrutura e dependências](../../../docs/architecture/project-structure.md).
