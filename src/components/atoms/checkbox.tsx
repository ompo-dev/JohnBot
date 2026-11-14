import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { Check } from "./icons";
import { cn } from "../utils";

export interface CheckboxProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export function Checkbox(props: CheckboxProps): JSX.Element {
  const local = props;
  const others = omit(props, "className", "type");
  return (
    <span className={cn("ui-checkbox relative inline-flex size-[var(--openbot-icon-md)] flex-none", local.className)}>
      <input
        className="ui-checkbox-input absolute inset-0 z-[1] m-0 size-full opacity-0"
        type="checkbox"
        data-cuelume-toggle=""
        {...others}
      />
      <span
        className="ui-checkbox-visual inline-flex size-full items-center justify-center"
        aria-hidden="true"
      >
        <Check />
      </span>
    </span>
  );
}
