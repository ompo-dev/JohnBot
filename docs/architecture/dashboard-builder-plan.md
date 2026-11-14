# Dashboards modulares e pessoas do John Twin

## Objetivo

Cada pessoa pode manter vários dashboards. Dashboards aparecem antes de Agentes no rail. Criar um painel abre uma tela de configuração semelhante à criação de agentes, com um construtor especializado. Depois de criado, o painel continua editável por conversa no mesmo padrão do assistente de diagramas.

## Execução

1. Preservar dashboards existentes e seus IDs. Acrescentar criação, seleção por URL, renomeação, duplicação e exclusão por revisão, idempotência e projeção otimista.
2. Integrar OpenUI com o design system existente. Registrar átomos, moléculas, layouts, controles, gráficos e componentes de domínio; gerar a especificação usada pelo modelo a partir da biblioteca real. Persistir o programa do painel, sem executar JavaScript/HTML gerados.
3. Vincular consultas e ações às APIs existentes: dados autorizados, filtros locais, agentes e rotinas. Notebooks são registros internos dos agentes; apenas seus resumos autorizados podem alimentar relatórios. O modelo combina componentes e estado reativo; as ações continuam sujeitas à validação da aplicação.
4. Usar um construtor especializado, identificado separadamente de pessoas e agentes operacionais. Reutilizar o formulário de setup e o chat flutuante existente, com histórico persistido por dashboard. Edições preservam os demais painéis.
5. Substituir as configurações de agente no John Twin por configurações de pessoa: identificação, vários cargos/setores, permissões herdadas e exceções individuais. Preservar autorização administrativa, negativas, expiração e auditoria.
6. Verificar contratos, migração compatível, isolamento de pessoas, concorrência, geração inválida, navegação, componentes e persistência real em PostgreSQL/Redis. Atualizar Docker e registrar commits por etapa.

## Fronteiras

PostgreSQL continua fonte dos documentos e históricos; Redis e Next mantêm caches versionados; Zustand reconcilia confirmação e falha. Credenciais e chamadas ao modelo permanecem no servidor. A biblioteca não oferece execução arbitrária de código nem acesso livre a endpoints. Os limites reais dos executores de rotinas permanecem visíveis.

## Verificação concluída

- Vários dashboards por pessoa, CRUD otimista, revisão, isolamento e autorização das fontes cobertos por testes.
- Criação com Gemini low pelo 9Router e persistência PostgreSQL/Redis verificadas no Docker. Transporte JSON explicita `stream: false`; o resumo da resposta é salvo no histórico, sem contaminar o contrato do painel.
- Exemplo gerado pelo Gemini é mantido como fixture para exercitar abas, gráficos, tabelas e consultas com os componentes originais.
- Configurações de pessoas, navegação StrictMode e links antigos de conexões/notebooks verificados em JSDOM. Sem automação de navegador.
- Notebooks permanecem internos. Conectores usam os apps instalados no Marketplace. Acessos reutiliza a navegação e os formulários de configurações.

## Referência

OpenUI permite definir uma biblioteca dos próprios componentes, gerar instruções dela e renderizar a composição do modelo. Referências oficiais: [componentes](https://www.openui.com/docs/openui-lang/defining-components), [integração](https://www.openui.com/docs/getting-started) e [ações](https://www.openui.com/docs/openui-lang/actions).

## Delegação

OpenCode usa uma configuração isolada do 9Router local com `ag/gemini-3.8-flash-low`. Por instrução do usuário, somente Gemini será usado nos subagentes daqui em diante. O subagente de pessoas trabalha apenas nos arquivos do John Twin; o principal integra, revisa e verifica o resultado. Não há automação de navegador.
