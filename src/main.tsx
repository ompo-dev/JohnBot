// Entrada do clone: segue exatamente o caminho upstream para rodar a UI sem o
// host — o JohnBotPlayground (componente existente do preview) instala o mock
// em `window.johnbot` e renderiza o App. Os dados vêm de demo-seed.ts, no mesmo
// padrão do landing-fixtures.ts upstream (um MockjohnBotOptions puro).
import { installPointerFocusGuard } from "@johnbot/ui/pointer-focus";
import { render } from "@solidjs/web";
// Copiar uma seleção com fórmula dá o LaTeX de origem, não o glifo duas vezes.
import "katex/contrib/copy-tex";
import { startActionSounds } from "./action-sounds";
import { syncAppearance } from "./appearance-choice";
import { DEMO_OPTIONS } from "./demo-seed";
import { johnBotPlayground as JohnBotPlayground } from "./preview/johnBotPlayground";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Renderer root element was not found.");
}

// O playground instala o mock durante o render; os efeitos de aparência e som
// rodam depois dele, na mesma ordem do index.tsx upstream.
render(() => <JohnBotPlayground options={DEMO_OPTIONS} />, root);

installPointerFocusGuard();
syncAppearance({ windowGlass: true });
startActionSounds();
