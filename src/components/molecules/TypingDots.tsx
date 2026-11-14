export function TypingDots(props: { className?: string }) {
  return (
    <span className={props.className ?? "typing-dots"} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
