/** The Undo toast of a workflow delete, in the layout of the agent delete toast. */

import { Button, Progress, toast, Workflow } from "@johnbot/ui";
import { currentText } from "../../components/text";
import { startUndoCountdown, type UndoCountdown } from "../agents/AgentDeleteUndoToast";

/** The toast after a workflow delete. The bar shows the time left. */
function WorkflowDeleteUndoToast(props: { name: string; countdown: UndoCountdown; onUndo: () => void }) {
  // Sonner renders the toast outside the component tree of the canvas.
  const { t } = currentText();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Hover/focus pauses the toast countdown without adding an action.
    <div
      className="agent-delete-undo-toast"
      onPointerEnter={() => props.countdown.hold("pointer", true)}
      onPointerLeave={() => props.countdown.hold("pointer", false)}
      onFocus={() => props.countdown.hold("focus", true)}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)))
          props.countdown.hold("focus", false);
      }}
    >
      <span className="wfn-undo-toast-tile" aria-hidden="true">
        <Workflow className="wfn-undo-toast-icon" />
      </span>
      <div className="agent-delete-undo-toast-text">
        <strong className="agent-delete-undo-toast-title">
          {t("workflow.canvas.deleteUndo.title", { name: props.name })}
        </strong>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => props.onUndo()}>
        {t("workflow.canvas.deleteUndo.action")}
      </Button>
      <Progress
        value={props.countdown.left() * 100}
        minValue={0}
        maxValue={100}
        className="agent-delete-undo-toast-bar"
        aria-hidden="true"
      />
    </div>
  );
}

let deleteToasts = 0;

/**
 * Shows the Undo toast of a workflow delete, as an agent delete does. When the time runs out, `onKeep`
 * runs; Undo runs `onUndo` in its place. Returns `keep`, which closes the toast and keeps the delete.
 * Each callback runs in a microtask, so a caller can write state from a cleanup.
 */
export function showWorkflowDeleteToast(title: string, handlers: { onUndo: () => void; onKeep: () => void }) {
  deleteToasts += 1;
  // Each delete has its own toast, so the close of an earlier one does not close a later one.
  const id = `workflow-delete-${deleteToasts}`;
  let settled = false;
  const settle = (then: () => void) => {
    if (settled) return;
    settled = true;
    countdown.stop();
    // A write to the Toaster or to the host from a scope cleanup stops the reactive system.
    queueMicrotask(() => {
      toast.dismiss(id);
      then();
    });
  };
  const keep = () => settle(handlers.onKeep);
  const countdown = startUndoCountdown(keep);
  toast(() => <WorkflowDeleteUndoToast name={title} countdown={countdown} onUndo={() => settle(handlers.onUndo)} />, {
    id,
    duration: Number.POSITIVE_INFINITY,
    unstyled: true,
    closeButton: false,
    class: "agent-delete-undo-toast-host wfn-undo-toast-host",
  });
  return keep;
}
