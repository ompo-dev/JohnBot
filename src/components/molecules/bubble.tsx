import { type ComponentProps, Dynamic, type JSX, type ValidComponent } from "@solidjs/web";
import { cva, type VariantProps } from "class-variance-authority";
import { omit } from "solid-js";
import { cn } from "../utils";

export interface BubbleGroupProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function BubbleGroup(props: BubbleGroupProps): JSX.Element {
  const others = omit(props, "className");
  return <div data-slot="bubble-group" className={cn("ui-bubble-group", props.className)} {...others} />;
}

export const bubbleVariants = cva("ui-bubble", {
  variants: {
    variant: {
      default: "ui-bubble-variant-default",
      secondary: "ui-bubble-variant-secondary",
      muted: "ui-bubble-variant-muted",
      tinted: "ui-bubble-variant-tinted",
      outline: "ui-bubble-variant-outline",
      ghost: "ui-bubble-variant-ghost",
      destructive: "ui-bubble-variant-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export type BubbleVariant = NonNullable<VariantProps<typeof bubbleVariants>["variant"]>;

export interface BubbleProps extends JSX.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
  variant?: BubbleVariant;
}

export function Bubble(props: BubbleProps): JSX.Element {
  const variant = () => props.variant ?? "default";
  const align = () => props.align ?? "start";
  const others = omit(props, "align", "className", "variant");
  return (
    <div
      data-slot="bubble"
      data-variant={variant()}
      data-align={align()}
      className={cn(bubbleVariants({ variant: variant() }), props.className)}
      {...others}
    />
  );
}

export type BubbleContentProps<T extends ValidComponent = "div"> = {
  as?: T;
  className?: JSX.HTMLAttributes<HTMLElement>["className"];
  children?: JSX.Element;
} & Omit<ComponentProps<T>, "as" | "className" | "children">;

export function BubbleContent<T extends ValidComponent = "div">(props: BubbleContentProps<T>): JSX.Element {
  const others = omit(props, "as", "className", "children");
  return (
    <Dynamic
      component={props.as ?? "div"}
      data-slot="bubble-content"
      className={cn("ui-bubble-content", props.className)}
      {...others}
    >
      {props.children}
    </Dynamic>
  );
}

const bubbleReactionsVariants = cva("ui-bubble-reactions", {
  variants: {
    side: {
      top: "ui-bubble-reactions-side-top",
      bottom: "ui-bubble-reactions-side-bottom",
    },
    align: {
      start: "ui-bubble-reactions-align-start",
      end: "ui-bubble-reactions-align-end",
    },
  },
  defaultVariants: {
    side: "bottom",
    align: "end",
  },
});

export interface BubbleReactionsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
  overflowCount?: number | undefined;
  side?: "top" | "bottom";
}

export function BubbleReactions(props: BubbleReactionsProps): JSX.Element {
  const align = () => props.align ?? "end";
  const side = () => props.side ?? "bottom";
  const others = omit(props, "align", "children", "className", "overflowCount", "side");
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align()}
      data-side={side()}
      className={cn(bubbleReactionsVariants({ align: align(), side: side() }), props.className)}
      {...others}
    >
      {props.children}
      {props.overflowCount && props.overflowCount > 0 ? (
        <span data-slot="bubble-reaction-overflow" className="ui-bubble-reaction-overflow" aria-hidden="true">
          +{props.overflowCount}
        </span>
      ) : null}
    </div>
  );
}
