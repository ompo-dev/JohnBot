import type { JSX } from "@solidjs/web";
import { createUniqueId, omit, Show } from "solid-js";
import { Heading, Text } from "../typography";
import { cn } from "../utils";

export interface SettingsSectionProps extends Omit<JSX.HTMLAttributes<HTMLElement>, "title"> {
  title: JSX.Element;
  description?: JSX.Element;
  actions?: JSX.Element;
}

export function SettingsSection(props: SettingsSectionProps): JSX.Element {
  const headingId = `settings-section-${createUniqueId()}`;
  const others = omit(props, "className", "title", "description", "actions", "children");

  return (
    <section className={cn("ui-settings-section", props.className)} aria-labelledby={headingId} {...others}>
      <div className="ui-settings-section-header">
        <div className="ui-settings-section-copy">
          <Heading id={headingId} className="ui-settings-section-heading" as="h3" size="sm" tone="secondary">
            {props.title}
          </Heading>
          <Show when={props.description}>
            <Text className="ui-settings-section-description" variant="caption" tone="muted">
              {props.description}
            </Text>
          </Show>
        </div>
        <Show when={props.actions}>
          <div className="ui-settings-section-actions">{props.actions}</div>
        </Show>
      </div>
      {props.children}
    </section>
  );
}
