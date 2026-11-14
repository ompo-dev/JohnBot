import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import * as ProgressPrimitive from "@kobalte/core/progress";
import type { ComponentProps, JSX, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "../utils";

type johnBotProgressProps = {
  className?: JSX.HTMLAttributes<HTMLElement>["className"];
};

export type ProgressProps<T extends ValidComponent = "div"> = PolymorphicProps<
  T,
  ProgressPrimitive.ProgressRootProps<T>
> &
  johnBotProgressProps &
  Partial<Pick<ComponentProps<T>, "className">>;

export function Progress<T extends ValidComponent = "div">(props: ProgressProps<T>): JSX.Element {
  const others = omit(props, "className");
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: Solid 2's omit cannot preserve Kobalte's generic polymorphic props.
  const rootProps = others as PolymorphicProps<T, ProgressPrimitive.ProgressRootProps<T>>;

  return (
    <ProgressPrimitive.Root<T> data-slot="progress" className={cn("ui-progress", props.className)} {...rootProps}>
      <ProgressPrimitive.Track data-slot="progress-track" className="ui-progress-track">
        <ProgressPrimitive.Fill data-slot="progress-fill" className="ui-progress-fill" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}
