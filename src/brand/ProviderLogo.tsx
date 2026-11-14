import type { JSX } from "@solidjs/web";
import { type ProviderLogoVariant, providerLogoShape } from "./provider-logo-shape";

export type { ProviderLogoVariant } from "./provider-logo-shape";

export interface ProviderLogoProps {
  provider: ProviderLogoVariant;
  className?: JSX.SvgSVGAttributes<SVGSVGElement>["className"];
}

export function ProviderLogo(props: ProviderLogoProps) {
  const shape = () => providerLogoShape(props.provider);
  return (
    <svg className={props.className} viewBox={shape().viewBox} aria-hidden="true" data-provider={props.provider}>
      {shape().paths.map((path, index) => (
        <path key={index} d={path.d} opacity={path.opacity} fillRule={path.evenOdd ? "evenodd" : undefined} />
      ))}
    </svg>
  );
}
