# Diretrizes Obrigatórias: Stack RTK + Caveman + Ponytail + Graphify + Zero-Write

Em todas as tarefas deste projeto, utilize a sequência das cinco disciplinas:

1. **Caveman** (`.agents/skills/caveman/SKILL.md`):
   - Responda de forma concisa, objetiva e direta aos fatos verificáveis.
   - Elimine enrolação, saudações e formalidades vazias.
   - Mantenha todos os dados técnicos, números, caminhos de arquivos e comandos verbatim.

2. **Ponytail** (`.agents/skills/ponytail/SKILL.md`):
   - Escolha a menor alteração completa e testável que resolva o problema (YAGNI).
   - Reutilize bibliotecas nativas, dependências já instaladas e padrões existentes no codebase antes de criar código novo.

3. **Graphify** (`.agents/skills/graphify/SKILL.md`):
   - Para dúvidas pontuais, use busca dirigida (`grep`, leitura direta de arquivos).
   - Use grafo estrutural quando precisar analisar relações complexas entre módulos ou arquitetura.

4. **Zero-Write Engineering** (`.agents/skills/zero-write-engineering/SKILL.md`):
   - Operações cirúrgicas e precisas em arquivos.
   - Não reemita nem regenere corpos de código já existentes apenas para transportá-los.

5. **RTK** (`.agents/skills/rtk/SKILL.md`):
   - Comprima saídas extensas de terminal quando suportado, sempre preservando erros, códigos de saída e evidências cruciais.

## Delegação com menor custo

Quando houver subtarefas independentes, usar o OpenCode com um modelo gratuito disponível, priorizando DeepSeek Flash. Conferir `opencode models` antes de escolher; nesta máquina foi validado `opencode/deepseek-v4.1-flash-free#low`. Não trocar automaticamente por um modelo pago quando o gratuito falhar. O agente principal revisa o código recebido e executa as verificações da integração. Não usar navegador ou controle da interface do computador para essas tarefas sem nova instrução do usuário.

## Organização e fronteiras

Seguir [o guia de estrutura](docs/architecture/project-structure.md) ao criar ou mover módulos. Hooks compartilhados ficam em `src/hooks`, estado em `src/stores`, processos em `src/workers` e handlers de jobs em `src/server/jobs`. Middlewares HTTP ficam em `src/server/middlewares`; portas UI/IPC continuam em `src/middlewares`. Testes ficam em `tests`; scripts são ferramentas de operação e desenvolvimento.

Executar `bun run check:architecture` depois de alterar dependências entre camadas. Não importar entrypoints `.worker.ts` na aplicação. Serviços/repositórios não carregam APIs Next; stores não executam HTTP. Preservar o fluxo de dados e os limites documentados.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
