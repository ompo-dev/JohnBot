"use client";

import React, { createContext, useContext, useState, type ReactNode } from "react";
import ReactDOM from "react-dom";
import { useCompatibleRef } from "./react-ref-compat";

const KOBALTE_PROP_BLACKLIST = new Set([
  "openDelay",
  "closeDelay",
  "gutter",
  "flip",
  "shift",
  "sameWidth",
  "fitViewport",
  "overflowPadding",
  "placement",
  "fallbackPlacements",
  "arrowPadding",
  "modal",
  "preventScroll",
  "forceMount",
  "anchorRef",
  "getAnchorRect",
  "unstyled",
  "validationState",
  "onCurrentPlacementChange",
  "onOpenAutoFocus",
  "onCloseAutoFocus",
  "onInteractOutside",
  "onPointerDownOutside",
  "onFocusOutside",
  "onEscapeKeyDown",
  "closeOnEscape",
  "closeOnOutsidePointer",
  "trapFocus",
  "item",
  "scrollToItem",
]);

function parseCssString(style: any): any {
  if (typeof style !== "string") return style;
  if (!style.trim()) return undefined;
  const result: Record<string, string> = {};
  const rules = style.split(";");
  for (const rule of rules) {
    const colon = rule.indexOf(":");
    if (colon > -1) {
      const prop = rule.slice(0, colon).trim();
      const val = rule.slice(colon + 1).trim();
      if (prop && val) result[prop] = val;
    }
  }
  return result;
}

// Helper for class / className / tabIndex / ref / filtering Kobalte props
function useSanitizedProps(props: any, isDomElement: boolean = true) {
  const { class: cls, className, tabindex, tabIndex, ref, ...rest } = props ?? {};
  const domRef = useCompatibleRef(ref);
  const result: any = {
    className: cls || className,
    tabIndex: tabIndex !== undefined ? tabIndex : tabindex,
    ...rest,
  };

  if (typeof result.style === "string") {
    result.style = parseCssString(result.style);
  }

  // Process ref (supports Solid chained refs [fn1, fn2], functions, and React refs)
  if (ref !== undefined) {
    result.ref = domRef;
    // ignore non-conforming refs on DOM elements
  }

  if (isDomElement) {
    if (result.value !== undefined) {
      result["data-value"] = typeof result.value === "object" ? JSON.stringify(result.value) : String(result.value);
      delete result.value;
    }
    if (result.checked !== undefined) {
      result["data-checked"] = result.checked ? "" : undefined;
      delete result.checked;
    }
    if (result.onFocusIn || result.onfocusin) {
      const handler = result.onFocusIn || result.onfocusin;
      const existing = result.onFocus;
      result.onFocus = (e: any) => {
        existing?.(e);
        handler(e);
      };
      delete result.onFocusIn;
      delete result.onfocusin;
    }
    if (result.onFocusOut || result.onfocusout) {
      const handler = result.onFocusOut || result.onfocusout;
      const existing = result.onBlur;
      result.onBlur = (e: any) => {
        existing?.(e);
        handler(e);
      };
      delete result.onFocusOut;
      delete result.onfocusout;
    }
    for (const key of Object.keys(result)) {
      if (KOBALTE_PROP_BLACKLIST.has(key)) {
        delete result[key];
      }
    }
  }

  return result;
}

// Polymorphic
export function Polymorphic(props: any) {
  const Comp = props.as || "div";
  const { as, ...rest } = props;
  const isDom = typeof Comp === "string";
  return React.createElement(Comp, useSanitizedProps(rest, isDom));
}
export type PolymorphicProps<T, P = {}> = P & { as?: any; class?: string; children?: ReactNode; [key: string]: any };

// Generic Base Component
function createComponent(defaultTag: string = "div", defaultRole?: string) {
  return function PrimitiveComponent(props: any) {
    const Comp = props.as || defaultTag;
    const { as, ...rest } = props;
    const isDom = typeof Comp === "string";
    const finalProps = useSanitizedProps(rest, isDom);
    if (defaultRole && !finalProps.role) finalProps.role = defaultRole;
    return React.createElement(Comp, finalProps);
  };
}

// Contexts for compound components
const GenericContext = createContext<any>({});

// Common Parts
export const Root = (props: any) => {
  const [open, setOpen] = useState(props.defaultOpen || false);
  const isOpen =
    typeof props.open === "function"
      ? Boolean(props.open())
      : props.open !== undefined
      ? Boolean(props.open)
      : open;
  const onOpenChange = (val: boolean) => {
    setOpen(val);
    props.onOpenChange?.(val);
  };
  const Comp = props.as;
  const { as, open: _o, defaultOpen: _d, onOpenChange: _c, ...rest } = props;
  const isDom = typeof Comp === "string";

  const contextValue = {
    source: props,
    open: isOpen,
    isOpen: () => isOpen,
    onOpenChange,
    checked: () => props.checked,
    isChecked: () => props.checked,
    inputRef: () => null,
    // Os componentes clonados do openbot leem `listState()` no contexto do
    // Kobalte real (Tabs/Select). Stub defensivo: nao da crash e mantem a UI.
    listState: () => ({
      selectedKey: () => undefined,
      selectionManager: () => ({ setFocusedKey: () => undefined }),
      disabledKeys: () => new Set<string>(),
    }),
  };
  const finalProps = useSanitizedProps(rest, !Comp || isDom);

  if (!Comp) {
    // O Kobalte real e polimorfico: Button.Root renderiza um <button>; os demais Roots
    // (Dialog/Popover/Tooltip...) sao renderless. Reproduz isso pelo data-slot.
    if (props["data-slot"] === "button") {
      return (
        <GenericContext.Provider value={contextValue}>
          {React.createElement("button", finalProps, props.children)}
        </GenericContext.Provider>
      );
    }
    return (
      <GenericContext.Provider value={contextValue}>
        {props.children}
      </GenericContext.Provider>
    );
  }

  return (
    <GenericContext.Provider value={contextValue}>
      {React.createElement(Comp, finalProps)}
    </GenericContext.Provider>
  );
};

export const Trigger = (props: any) => {
  const ctx = useContext(GenericContext);
  const Comp = props.as || "button";
  const { as, onClick, ...rest } = props;
  const handleClick = (e: any) => {
    onClick?.(e);
    ctx.onOpenChange?.(!ctx.open);
  };
  const isDom = typeof Comp === "string";
  return React.createElement(Comp, {
    type: isDom && Comp === "button" ? "button" : undefined,
    "aria-expanded": typeof ctx.open === "boolean" ? ctx.open : undefined,
    "data-expanded": ctx.open ? "" : undefined,
    ...useSanitizedProps(rest, isDom),
    onClick: handleClick,
  });
};

export const Portal = ({ children }: any) => {
  const ctx = useContext(GenericContext);
  if (ctx && ctx.open === false) return null;
  return typeof document !== "undefined"
    ? ReactDOM.createPortal(children, document.body)
    : <>{children}</>;
};

export const Overlay = (props: any) => {
  const ctx = useContext(GenericContext);
  const Comp = props.as || "div";
  const { as, onClick, ...rest } = props;
  const isDom = typeof Comp === "string";
  const finalProps = useSanitizedProps(rest, isDom);
  if (ctx && ctx.open === false) return null;
  const handleClick = (e: any) => {
    onClick?.(e);
    if (!e?.defaultPrevented) {
      ctx?.onOpenChange?.(false);
    }
  };
  return React.createElement(Comp, { ...finalProps, onClick: handleClick });
};

export const Content = (props: any) => {
  const ctx = useContext(GenericContext);
  const Comp = props.as || "div";
  const { as, ...rest } = props;
  const isDom = typeof Comp === "string";
  const finalProps = useSanitizedProps(rest, isDom);
  if (ctx && ctx.open === false) return null;
  return React.createElement(Comp, { ...finalProps, "data-expanded": ctx.open ? "" : undefined });
};

export const Title = createComponent("h2");
export const Description = createComponent("p");

export const CloseButton = (props: any) => {
  const ctx = useContext(GenericContext);
  const Comp = props.as || "button";
  const { as, onClick, ...rest } = props;
  const isDom = typeof Comp === "string";
  const handleClick = (e: any) => {
    onClick?.(e);
    if (!e?.defaultPrevented) {
      ctx?.onOpenChange?.(false);
    }
  };
  return React.createElement(Comp, {
    type: isDom && Comp === "button" ? "button" : undefined,
    ...useSanitizedProps(rest, isDom),
    onClick: handleClick,
  });
};
export const Arrow = createComponent("div");
export const Icon = createComponent("span");
export const Value = createComponent("span");
export const ValueLabel = createComponent("span");
const GenericItem = createComponent("div", "option");
export function Item(props: any) {
  const context = useContext(GenericContext);
  const { item, onClick, ...rest } = props;
  return <GenericItem {...rest} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented && item) context.source?.onChange?.(item.rawValue);
  }} />;
}
export const ItemLabel = createComponent("span");
export const ItemIndicator = createComponent("span");
export const ItemControl = createComponent("div");
export const ItemDescription = createComponent("p");
export const ItemInput = createComponent("input");
export const CheckboxItem = createComponent("div", "checkbox");
export const RadioItem = createComponent("div", "radio");
export const Section = createComponent("div");
export function Listbox(props: any) {
  const context = useContext(GenericContext);
  const { children, scrollToItem, ...rest } = props;
  const source = context.source;
  const nodes: any[] = [];
  for (const option of source?.options ?? []) {
    const group = source.optionGroupChildren && option[source.optionGroupChildren];
    if (group) nodes.push({ type: "section", key: "", rawValue: option });
    for (const value of group ?? [option]) {
      const key = typeof source.optionValue === "function" ? source.optionValue(value) : source.optionValue ? value[source.optionValue] : value;
      nodes.push({ type: "item", key: String(key), rawValue: value });
    }
  }
  // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: The listbox role is applied to the list container that owns the options.
  return <ul {...useSanitizedProps(rest)} role="listbox">{typeof children === "function" ? children(() => nodes) : children}</ul>;
}
export const Input = createComponent("input");
export const Control = createComponent("div");
export const Track = createComponent("div");
export const Fill = createComponent("div");
export const Thumb = createComponent("div");
export const Label = createComponent("label");
export const Indicator = createComponent("span");
export const List = createComponent("div");
export const Header = createComponent("header");
export const Separator = createComponent("div", "separator");
export const Sub = Root;
export const SubContent = Content;
export const SubTrigger = Trigger;
export const ErrorMessage = createComponent("div", "alert");
export const HiddenSelect = () => null;

// Compound component helper
function makeCompound(base: any, parts: Record<string, any>) {
  return Object.assign(base, parts);
}

export const Group = createComponent("div", "group");

export const RadioGroup = makeCompound(createComponent("div", "radiogroup"), {
  Root,
  Label,
  Description,
  ErrorMessage,
  Item,
  ItemInput,
  ItemControl,
  ItemIndicator,
  ItemLabel,
  ItemDescription,
});

export const DropdownMenu = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Content,
  Overlay,
  Item,
  ItemLabel,
  ItemIndicator,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  Separator,
  Sub,
  SubTrigger,
  SubContent,
  Arrow,
  Icon,
  Group,
});

export const ContextMenu = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Content,
  Overlay,
  Item,
  ItemLabel,
  ItemIndicator,
  CheckboxItem,
  RadioGroup,
  RadioItem,
  Separator,
  Sub,
  SubTrigger,
  SubContent,
  Arrow,
  Icon,
  Group,
});

export const Dialog = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Overlay,
  Content,
  CloseButton,
  Title,
  Description,
});

export const AlertDialog = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Overlay,
  Content,
  CloseButton,
  Title,
  Description,
});

export const Popover = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Content,
  CloseButton,
  Title,
  Description,
  Arrow,
  Anchor: createComponent("div"),
});

export const Tooltip = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Content,
  Arrow,
});

export const Select = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Content,
  Arrow,
  Value,
  ValueLabel,
  Item,
  ItemLabel,
  ItemIndicator,
  ItemDescription,
  Section,
  Listbox,
  Label,
  Description,
  ErrorMessage,
  HiddenSelect,
  Icon,
});

export const Combobox = makeCompound(Root, {
  Root,
  Trigger,
  Portal,
  Content,
  Arrow,
  Value,
  ValueLabel,
  Item,
  ItemLabel,
  ItemIndicator,
  ItemDescription,
  Section,
  Listbox,
  Label,
  Description,
  ErrorMessage,
  HiddenSelect,
  Icon,
  Input,
  Control,
});

export const Tabs = makeCompound(Root, {
  Root,
  List,
  Trigger,
  Content,
  Indicator,
});

export const Slider = makeCompound(Root, {
  Root,
  Track,
  Fill,
  Thumb,
  Label,
  ValueLabel,
  Input,
});

export const Switch = makeCompound(Root, {
  Root,
  Input,
  Control,
  Thumb,
  Label,
  Description,
  ErrorMessage,
});

export const Progress = makeCompound(Root, {
  Root,
  Track,
  Fill,
  Label,
  ValueLabel,
});

// Context helpers
export function useComboboxContext() {
  return useContext(GenericContext);
}
export function useSelectContext() {
  return useContext(GenericContext);
}
export function useTabsContext() {
  return useContext(GenericContext);
}
export function usePopoverContext() {
  return useContext(GenericContext);
}
export function useSwitchContext() {
  return useContext(GenericContext);
}
