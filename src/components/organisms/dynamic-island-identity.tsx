import type { JSX } from "@solidjs/web";
import { omit, Show } from "solid-js";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "../item";
import { cn } from "../utils";

export interface DynamicIslandIdentityProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "children"> {
  name: string;
  status: string;
  description: JSX.Element;
  descriptionRef?: (element: HTMLSpanElement) => void;
  trailing?: JSX.Element;
}

export function DynamicIslandIdentity(props: DynamicIslandIdentityProps): JSX.Element {
  const others = omit(props, "className", "name", "status", "description", "descriptionRef", "trailing");
  return (
    <Item size="compact" className={cn("ui-dynamic-island-identity", props.className)} {...others}>
      <ItemMedia className="ui-dynamic-island-identity-avatar" aria-hidden="true" />
      <ItemContent className="ui-dynamic-island-identity-copy" data-island-motion-content>
        <ItemTitle className="ui-dynamic-island-identity-title">
          <span className="ui-dynamic-island-identity-name">{props.name}</span>
          <span className="ui-dynamic-island-identity-status">{props.status}</span>
        </ItemTitle>
        <ItemDescription
          ref={(element) => props.descriptionRef?.(element)}
          className="ui-dynamic-island-identity-description"
        >
          {props.description}
        </ItemDescription>
      </ItemContent>
      <Show when={props.trailing}>
        <ItemActions className="ui-dynamic-island-identity-trailing" data-island-motion-content>
          {props.trailing}
        </ItemActions>
      </Show>
    </Item>
  );
}
