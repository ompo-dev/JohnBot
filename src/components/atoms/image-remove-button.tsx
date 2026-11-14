import { Button } from "./button";
import { X } from "./icons";
import { cn } from "../utils";

export interface ImageRemoveButtonProps {
  label: string;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}

export function ImageRemoveButton(props: ImageRemoveButtonProps) {
  return (
    <Button
      type="button"
      variant="destructive-ghost"
      size="icon-xs"
      className={cn("ui-image-remove-button", props.className)}
      aria-label={props.label}
      title={props.label}
      data-cuelume-tap="close"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <X aria-hidden="true" />
    </Button>
  );
}
