import { useState } from "react";
import { useUrlSignal } from "./url-state";

/** Share the primitive's committed open state with the original Kobalte CSS markers. */
export function usePopupState(props: { queryKey?: string; open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [uncontrolled, setUncontrolled] = useState(props.defaultOpen ?? false);
  const [selection, setSelection] = useUrlSignal("select");
  const urlControlled = props.queryKey !== undefined && props.open === undefined;
  return {
    open: urlControlled ? selection() === props.queryKey : props.open ?? uncontrolled,
    onOpenChange(next: boolean) {
      if (urlControlled) {
        if (next) setSelection(props.queryKey!);
        else if (selection() === props.queryKey) setSelection(null);
      }
      if (props.open === undefined) setUncontrolled(next);
      props.onOpenChange?.(next);
    },
  };
}
