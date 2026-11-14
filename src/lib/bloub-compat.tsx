"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  blockAt, BotEngine, COLOR_BY_ID, DEFAULT_COLOR, DEFAULT_EXPRESSION, DEFAULT_SHAPE,
  DEMI_VIEWBOX, EXPRESSION_BY_ID, mixHex, RAYON, SHAPE_BY_ID,
} from "../../node_modules/@norbert_bodziony/bloub/dist/package/server.js";
export * from "../../node_modules/@norbert_bodziony/bloub/dist/package/server.js";

export interface BloubBotProps {
  size?: number | string;
  shape?: string;
  color?: string;
  expression?: string;
  state?: Parameters<BotEngine["setState"]>[0];
  cycle?: Parameters<typeof blockAt>[0];
  paper?: string;
  frozenAt?: number;
  playing?: boolean;
  fps?: number;
  initialPhase?: number;
  gaze?: any;
  ref?: any;
  ariaLabel?: string;
  class?: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface BloubBotRef {
  readonly svg: SVGSVGElement | null;
  renderAt: (time: number) => void;
}

export function BloubBot(props: BloubBotProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const size = props.size ?? 320;
  const color = COLOR_BY_ID.get(props.color ?? DEFAULT_COLOR)?.hex ?? props.color ?? COLOR_BY_ID.get(DEFAULT_COLOR)?.hex;
  const paper = props.paper ?? "#f9f9f9";
  const id = useId();
  const extent = DEMI_VIEWBOX * 2;
  const bounds = { x: -DEMI_VIEWBOX, y: -DEMI_VIEWBOX, width: extent, height: extent };
  const { shape, expression, state, cycle, frozenAt, initialPhase, fps, playing, gaze, ref } = props;
  const engine = useMemo(() => new BotEngine(RAYON, state ?? "idle",
    SHAPE_BY_ID.get(shape ?? DEFAULT_SHAPE)?.radii,
    EXPRESSION_BY_ID.get(expression ?? DEFAULT_EXPRESSION)), [shape, expression, state]);
  const [time, setTime] = useState<number | null>(null);
  const elapsed = time ?? frozenAt ?? initialPhase ?? 0;
  const block = cycle?.length ? blockAt(cycle, elapsed) : undefined;
  const cycleState = block && cycle ? cycle[block.index]?.state : undefined;
  const frame = useMemo(() => {
    if (!cycleState || state) return engine.sample(elapsed);
    const cycleEngine = new BotEngine(RAYON, cycleState, SHAPE_BY_ID.get(shape ?? DEFAULT_SHAPE)?.radii,
      EXPRESSION_BY_ID.get(expression ?? DEFAULT_EXPRESSION));
    if (gaze) cycleEngine.setLook(gaze(elapsed), 0, 0);
    return cycleEngine.sample(block?.elapsed ?? 0);
  }, [engine, elapsed, block?.elapsed, cycleState, state, gaze, shape, expression]);

  useEffect(() => {
    const refObj: BloubBotRef = {
      get svg() { return svgRef.current; },
      renderAt: setTime,
    };
    if (typeof ref === "function") {
      ref(refObj);
    } else if (ref && typeof ref === "object") {
      ref.current = refObj;
    }
  }, [ref]);

  useEffect(() => {
    if (!playing || frozenAt !== undefined) return;
    let request = 0;
    let start: number | undefined;
    let last = -Infinity;
    function tick(now: number) {
      start ??= now;
      if (now - last >= 1000 / (fps ?? 60) - 1) {
        last = now;
        setTime((initialPhase ?? 0) + (now - start) / 1000);
      }
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, frozenAt, fps, initialPhase]);

  const dots = frame.dots.map((dot, index) => {
    const fill = dot.color ?? (dot.depth === undefined || !color ? color : mixHex(paper, color, dot.depth));
    return dot.d
      ? <path key={index} d={dot.d} transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`} fill={fill} opacity={dot.opacity} />
      : <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />;
  });
  function arcs(side: "front" | "back") {
    return <g fill="none" strokeLinecap="round">{frame.arcs.map((arc) => (
      <path key={arc.id} d={arc[side]} stroke={`url(#${id}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
    ))}</g>;
  }

  return (
    <svg
      ref={svgRef}
      className={props.className ?? props.class}
      width={size}
      height={size}
      viewBox={`${bounds.x} ${bounds.y} ${extent} ${extent}`}
      aria-label={props.ariaLabel ?? "Animated Bloub avatar"}
      role="img"
      style={props.style}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" {...bounds}>
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, index) => <path key={index} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />)}
          {frame.notch && <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />}
        </mask>
        {frame.arcs.map(({ id: arcId, grad: { stops, ...gradient } }) => (
          <linearGradient key={arcId} id={`${id}-${arcId}`} gradientUnits="userSpaceOnUse" {...gradient}>
            {stops.map((stop, index) => <stop key={index} offset={index / (stops.length - 1)} stopColor={stop} />)}
          </linearGradient>
        ))}
      </defs>
      {arcs("back")}
      {frame.dotsBehind && <g>{dots}</g>}
      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={paper} />
        <g mask={`url(#${id})`}><rect {...bounds} fill={color} /></g>
      </g>
      {!frame.dotsBehind && <g>{dots}</g>}
      {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill="#2496e8" />}
      {arcs("front")}
    </svg>
  );
}

export default BloubBot;
