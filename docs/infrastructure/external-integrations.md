# Integrações externas

O JohnBot separa integrações de agentes e ontologia em `src/server/integrations`. Elas nunca são importadas por componentes, hooks ou stores.

## A2A

`@a2a-js/sdk` está instalado para descobrir cartões de agente A2A. A rota autenticada `GET /api/integrations` retorna somente um resumo sem tokens:

~~~json
{
  "a2a": [{ "id": "planner", "status": "ready", "name": "Planejador" }],
  "autoOntology": { "configured": false, "status": "disabled" }
}
~~~

Configure endpoints apenas no ambiente do servidor:

~~~env
JOHNBOT_A2A_ENDPOINTS=[{"id":"planner","url":"https://planner.example.com","token":"secret"}]
~~~

Os IDs são únicos, há no máximo 20 endpoints e URLs precisam ser HTTPS. A descoberta bloqueia redirecionamentos e requests para outra origem. O token nunca é serializado, logado ou exposto ao cliente.

Esta primeira etapa é deliberadamente somente leitura. Criar ou acompanhar tarefas A2A exige um comando idempotente, persistência do vínculo de tarefa e um job da outbox; não deve ser disparado diretamente por um componente.

## Auto Ontology

O Auto Ontology da NVIDIA é um serviço Python separado, dependente de modelo e credenciais. O JohnBot não inclui seu código-fonte, imagens ou chaves no Compose. Quando existir um endpoint HTTPS próprio, configure:

~~~env
JOHNBOT_AUTO_ONTOLOGY_URL=https://ontology.internal.example
JOHNBOT_AUTO_ONTOLOGY_TOKEN=secret
~~~

O adaptador verifica apenas `GET /api/health` e retorna `disabled`, `ready` ou `unavailable`. Ele não transmite documentos, conversas ou credenciais. A indexação semântica deve entrar posteriormente por comando idempotente e job, com a política de acesso definida.

## billion-context

`billion-context` é uma ferramenta local de desenvolvimento para compressão de contexto. Ela foi instalada como plugin do OpenCode no perfil do desenvolvedor, não como dependência de runtime do JohnBot. Não faz parte da imagem Docker, não recebe tráfego do aplicativo e não pode receber segredos ou dados de usuários.

## Verificação

~~~sh
bun run test:unit
bun run check:architecture
bun run build
curl http://localhost:3000/api/integrations
~~~
