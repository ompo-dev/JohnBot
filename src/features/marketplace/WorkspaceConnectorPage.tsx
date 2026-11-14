import { useState } from "react";
import { Alert, Badge, Button, Item, ItemContent, ItemDescription, ItemGroup, ItemTitle, SettingsSection, Spinner } from "@johnbot/ui";
import { connectorPreviewSchema } from "../../contracts/connector-preview";
import { useDataQuery } from "../../hooks/use-data-query";
import { IntegrationPage } from "../settings/IntegrationLayout";
import { DataTable } from "../operations/operations-ui";
import { AppMark } from "./MarketplaceParts";
import type { MarketplaceApp } from "./marketplace-model";
import type { MarketplaceScope } from "./marketplace-view";

type WorkspaceApp = Extract<MarketplaceApp, {kind:"workspace"}>;
const modeLabel = {real:"Local funcional",partial:"Parcial",mock:"Demonstração"};

export function WorkspaceConnectorAction({scope,app}: {scope:MarketplaceScope;app:WorkspaceApp}) {
  const installation = scope.model.workspaceInstallation;
  return <Button type="button" size="sm" variant={app.connector.installed ? "outline" : "secondary"} aria-label={`${app.connector.installed ? "Remover" : "Instalar"} ${app.name}`} disabled={!installation?.canInstall || installation.saving} onClick={() => void installation?.set(app.id,!app.connector.installed)}>{app.connector.installed ? "Remover" : "Instalar"}</Button>;
}

export function WorkspaceConnectorPage({scope,app}: {scope:MarketplaceScope;app:WorkspaceApp}) {
  const [exploring,setExploring] = useState(false);
  const installation = scope.model.workspaceInstallation;
  return <IntegrationPage name={app.name} logo={<AppMark app={app}/>} subtitle={app.tagline} status={app.status} statusLabel={app.connector.installed ? "Instalado" : "Disponível para instalar"} actions={<WorkspaceConnectorAction scope={scope} app={app}/> }>
    {installation?.error && <Alert tone="danger" role="alert">{installation.error}</Alert>}
    <SettingsSection title="Capacidades" description={app.connector.implementation === "mock" ? "Este conector usa dados de demonstração. Nenhuma mensagem ou operação é enviada para serviços externos." : app.connector.detail}>
      <Badge variant={app.connector.implementation === "real" ? "success-light" : "secondary"}>{modeLabel[app.connector.implementation]}</Badge>
      <ItemGroup className="settings-modal-card">{app.connector.capabilities.map((capability) => <Item key={capability} className="settings-modal-row"><ItemContent><ItemTitle>{capability}</ItemTitle><ItemDescription>{app.connector.installed ? "Adicionado ao espaço de trabalho" : "Instale para disponibilizar aos agentes"}</ItemDescription></ItemContent></Item>)}</ItemGroup>
    </SettingsSection>
    {app.connector.installed && <SettingsSection title="Recursos disponíveis"><Button size="sm" variant="outline" aria-expanded={exploring} onClick={() => setExploring(!exploring)}>{exploring ? "Fechar recursos" : "Explorar recursos"}</Button>{exploring && <ConnectorResources key={`${app.id}:${installation?.viewerId}:${installation?.revision}`} id={app.id} viewer={installation?.viewerId ?? ""} revision={installation?.revision ?? 0}/>}</SettingsSection>}
  </IntegrationPage>;
}

function ConnectorResources({id,viewer,revision}:{id:string;viewer:string;revision:number}) {
  const query=useDataQuery(`/api/connections?${new URLSearchParams({connector:id,viewer,scope:String(revision)})}`,connectorPreviewSchema);
  if(query.error) return <Alert tone="danger" role="alert">{query.error}</Alert>;
  if(!query.data) return <Spinner label="Carregando recursos autorizados"/>;
  return <>{query.data.resources.map((resource)=><SettingsSection key={resource.id} title={resource.name}><DataTable headers={resource.columns} rows={resource.rows}/></SettingsSection>)}</>;
}
