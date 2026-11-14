import { NotificationObserver, Toaster } from "@johnbot/ui";
import { AppAccessGate } from "./AppView";
import { type AppProps, AppProviders } from "./app-providers";
import { reportNotification } from "./error-reports";
import { UrlStateBoundary } from "./lib/url-state";

export function App(props: AppProps = {}) {
  return (
    <UrlStateBoundary>
    <NotificationObserver onShown={reportNotification}>
      <AppProviders
        landingPreview={props.landingPreview}
        peopleEnabled={props.peopleEnabled}
        chatWindow={props.chatWindow}
      >
        <AppAccessGate />
      </AppProviders>
      <Toaster onToastShown={reportNotification} />
    </NotificationObserver>
    </UrlStateBoundary>
  );
}

export default App;
