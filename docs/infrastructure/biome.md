# Biome

Versão fixada: `@biomejs/biome` `2.6.6` (devDependency). O lockfile `bun.lock`
continua sendo a fonte de resolução (`bun install --frozen-lockfile`).

## Escopo

- `bun run lint`: lint de `src/`, `scripts/`, `stories/` e `tools/` com o preset
  `recommended`.
- `bun run format:check`: formatação apenas de arquivos novos/de infraestrutura
  (`package.json`, `tsconfig.base.json`, `next.config.ts`, `biome.jsonc`,
  `scripts/run-lint.mjs`).
- `bun run check`: executa os dois.

O código legado não é reformatado em massa. `biome.jsonc` usa `vcs.useIgnoreFile`,
portanto respeita `.gitignore` e não varre builds, caches ou `node_modules`.

`scripts/run-lint.mjs` conta os arquivos antes de invocar o Biome. Se o escopo
ficar vazio, o script falha; um lint vazio não passa silenciosamente.

## Regras desativadas ou rebaixadas

- `correctness/useHookAtTopLevel`: desativada. O shim Solid/React usa funções com
  prefixo `use` que não são hooks React; a regra produz 102 falsos positivos.
- `correctness/noUnresolvedImports`: desativada. Os aliases são resolvidos pelo
  Next/Turbopack e não pelo Biome.
- `correctness/noComponentHookFactories`: `warn`. A camada de compatibilidade cria
  factories de componentes; reportar sem bloquear.
- `correctness/useExhaustiveDependencies`: `warn`. Efeitos legados usam o modelo
  Solid; reportar sem bloquear.
- `suspicious/noArrayIndexKey`: `warn`.
- Regras de a11y com dívida legada (`noNoninteractiveTabindex`,
  `noLabelWithoutControl`, `useSemanticElements`, `useAriaPropsForRole`,
  `useButtonType`): `warn`.

Casos pontuais usam `biome-ignore` com justificativa no próprio código:
`MathFormula` (HTML gerado localmente pelo KaTeX), toasts de undo (hover/focus
pausa o contador), `BrowserDock` (hover atrasa o fechamento) e o `role="listbox"`
do shim Kobalte.

## Correções feitas para o baseline

- dois `onFocus`/`onBlur` duplicados em `DynamicIslandSurface`;
- `key` ausente em itens de `Tabs.Trigger` em `SettingsModal` e
  `WebAccountSettings`.

Não há verificação de tipos neste check. `next.config.ts` mantém
`typescript.ignoreBuildErrors: true`; nenhum resultado deve ser descrito como
typecheck completo.


## Hooks React nativos

`useHookAtTopLevel` permanece como erro em `src/app/**`,
`src/lib/url-state.tsx` e `scripts/**`. A exceção do legado Solid não desativa
essa proteção nas entradas React e no estado de URL. Novos módulos React devem
entrar nesse escopo ao serem adicionados.

O lint atual passa com avisos de dívida legada; avisos não equivalem a erros
corrigidos. A configuração mantém essas ocorrências visíveis.
