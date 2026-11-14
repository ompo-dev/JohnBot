"use client";

import React, { createContext, useContext, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";

const Selection = createContext<string | undefined>(undefined);

export function Root({ onChange, onValueChange, value, defaultValue, children, ...props }: any) {
  const [selected, setSelected] = useState(defaultValue);
  const current = value ?? selected;
  return (
    <Selection value={current}>
      <Tabs.Root {...props} value={current} onValueChange={(next) => {
        setSelected(next);
        onChange?.(next);
        onValueChange?.(next);
      }}>
        {children}
      </Tabs.Root>
    </Selection>
  );
}

export const List = Tabs.List;
export function Trigger(props: any) {
  const selected = useContext(Selection) === props.value;
  return <Tabs.Trigger {...props} data-selected={selected ? "" : undefined} />;
}
export function Content({ forceMount, ...props }: any) {
  const selected = useContext(Selection) === props.value;
  return <Tabs.Content {...props} forceMount={forceMount ? true : undefined}
    data-selected={selected ? "" : undefined} hidden={!selected} />;
}
export function Indicator(props: any) {
  return <div {...props} aria-hidden="true" />;
}
export function useTabsContext() {
  const selected = useContext(Selection);
  return { listState: () => ({ selectedKey: () => selected }) };
}
