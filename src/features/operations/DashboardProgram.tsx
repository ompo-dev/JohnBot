"use client";
import React, { useEffect, useMemo, type ReactNode, type CSSProperties } from "react";
import {
  createLibrary,
  defineComponent,
  Renderer,
  useStateField,
  useTriggerAction,
} from "@openuidev/react-lang";
import type { ActionEvent } from "@openuidev/lang-core";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Heading,
  Input,
  MotionTooltip,
  NativeSelect,
  Progress,
  Separator,
  Switch,
  Text,
  Textarea,
  UserAvatar,
} from "@johnbot/ui";
import { SliderField } from "../../components/atoms/slider";
import { Tabs } from "../../components/complex";
import { Bar, BarChart, Area, AreaChart } from "recharts";
import {
  CartesianGrid,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  XAxis,
  YAxis,
} from "@johnbot/ui/chart";
import type { Operations } from "../../contracts/operations";
import type { WorkflowSummary } from "../../contracts/ipc-workflows";
import type { ClientAgentSummary } from "../../contracts/ipc-agents";
import {
  dashboardComponents,
  dashboardActions,
  dashboardFunctions,
  validateDashboardProgram,
} from "../../contracts/dashboard-library";
import { dashboardSourceData } from "../../lib/dashboard-data";
import { DataTable } from "./operations-ui";

export interface DashboardProgramProps {
  program: string;
  state: Operations;
  routines: WorkflowSummary[];
  agents: ClientAgentSummary[];
  onAction: (event: ActionEvent) => void;
  onError?: (message: string) => void;
}

type RenderProps = { props: Record<string, any>; renderNode: (node: any) => ReactNode };
function children(props: RenderProps) {
  return (props.props.children ?? []).map((node: unknown, index: number) => (
    <React.Fragment key={index}>{props.renderNode(node)}</React.Fragment>
  ));
}
function scalar(value: unknown): string {
  return value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
}
function spacing(value: unknown): string {
  return typeof value === "string" && /^\d{1,2}(\.\d{1,2})?(px|rem|em)$/.test(value)
    ? value
    : "1rem";
}
function Layout({ props, renderNode, kind }: RenderProps & { kind: string }) {
  const style: CSSProperties =
    kind === "Grid"
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${Math.max(220, Math.floor(1000 / Math.min(4, Math.max(1, props.columns ?? 2))))}px), 1fr))`,
          gap: spacing(props.gap),
        }
      : {
          display: "flex",
          flexWrap: kind === "Row" ? "wrap" : undefined,
          flexDirection: kind === "Row" || props.direction === "horizontal" ? "row" : "column",
          gap: spacing(props.gap),
          alignItems: props.align,
          justifyContent:
            ({ between: "space-between", around: "space-around" } as Record<string, string>)[
              props.justify
            ] ?? props.justify,
        };
  return (
    <div data-testid={`openui-${kind.toLowerCase()}`} className="min-w-0" style={style}>
      {children({ props, renderNode })}
    </div>
  );
}
function ProgramInput({ props, kind }: RenderProps & { kind: string }) {
  const toggle = kind === "Checkbox" || kind === "Switch";
  const field = useStateField(props.name ?? kind, toggle ? props.checked : props.value);
  const shared = {
    name: props.name,
    disabled: props.disabled,
    "aria-label": props.label ?? props.placeholder ?? props.name ?? kind,
    "data-testid": `openui-${kind.toLowerCase()}`,
  };
  if (kind === "Checkbox")
    return (
      <label className="flex items-center gap-2">
        <Checkbox
          {...shared}
          checked={!!field.value}
          onChange={(event) => field.setValue(event.target.checked)}
        />
        {props.label}
      </label>
    );
  if (kind === "Switch")
    return (
      <label className="flex items-center gap-2">
        <Switch
          {...shared}
          checked={!!field.value}
          onChange={(checked: boolean) => field.setValue(checked)}
        />
        {props.label}
      </label>
    );
  if (kind === "Slider")
    return (
      <SliderField
        label={props.name ?? "Valor"}
        value={Number(field.value ?? props.min ?? 0)}
        minValue={props.min ?? 0}
        maxValue={props.max ?? 100}
        step={props.step ?? 1}
        disabled={props.disabled}
        formatValue={String}
        onChange={(value) => field.setValue(value)}
      />
    );
  if (kind === "Select")
    return (
      <NativeSelect
        {...shared}
        value={field.value ?? ""}
        onChange={(event) => field.setValue(event.target.value)}
      >
        {props.placeholder && (
          <option value="" disabled>
            {props.placeholder}
          </option>
        )}
        {props.options.map((option: { value: string; label: string }) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    );
  if (kind === "Textarea")
    return (
      <Textarea
        {...shared}
        value={field.value ?? ""}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
        onChange={(event) => field.setValue(event.target.value)}
      />
    );
  return (
    <Input
      {...shared}
      type={props.type ?? "text"}
      value={field.value ?? ""}
      placeholder={props.placeholder}
      onValueChange={(value) => field.setValue(value)}
    />
  );
}
function ProgramButton({ props }: RenderProps) {
  const trigger = useTriggerAction();
  return (
    <Button
      data-testid="openui-button"
      type="button"
      size="sm"
      variant={props.variant}
      disabled={props.disabled}
      onClick={() => props.action && trigger(props.label, undefined, props.action)}
    >
      {props.label}
    </Button>
  );
}
function ProgramTabs({ props, renderNode }: RenderProps) {
  const field = useStateField("activeTab", props.activeTab ?? props.tabs[0]?.id);
  return (
    <Tabs.Root value={field.value} onChange={(value: string) => field.setValue(value)}>
      <Tabs.List aria-label="Seções do dashboard">
        {props.tabs.map((tab: any) => (
          <Tabs.Trigger key={tab.id} value={tab.id}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {props.tabs.map((tab: any) => (
        <Tabs.Content key={tab.id} value={tab.id}>
          {renderNode(tab.content)}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
function ProgramTable({ props }: RenderProps) {
  const data = Array.isArray(props.data) ? props.data : [];
  const columns =
    props.columns ??
    Object.keys(data[0] ?? {})
      .slice(0, 12)
      .map((key) => ({ key, header: key }));
  return (
    <DataTable
      headers={columns.map((column: any) => column.header)}
      rows={data.map((row: any) => columns.map((column: any) => scalar(row?.[column.key])))}
    />
  );
}
function ProgramChart({ props, area }: RenderProps & { area: boolean }) {
  const data = Array.isArray(props.data) ? props.data : [];
  const Chart = area ? AreaChart : BarChart;
  const Series = area ? Area : Bar;
  return (
    <section
      className="agent-usage-trend min-w-0"
      data-testid={area ? "openui-area-chart" : "openui-bar-chart"}
    >
      {props.title && (
        <Heading as="h3" size="sm">
          {props.title}
        </Heading>
      )}
      <ChartContainer label={props.title ?? "Dados do dashboard"}>
        <Chart data={data} accessibilityLayer margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--johnbot-border-strong)" />
          <XAxis dataKey={props.xKey ?? "group"} tickLine={false} axisLine={false} />
          <YAxis width={48} tickLine={false} axisLine={false} />
          <ChartTooltip content={(tooltip: object) => <ChartTooltipContent {...tooltip} formatValue={(value: number) => new Intl.NumberFormat("pt-BR", props.yKey === "failure_rate" ? {style:"percent", maximumFractionDigits:1} : {maximumFractionDigits:2}).format(value)} />} />
          <Series
            dataKey={props.yKey ?? "failure_rate"}
            fill="var(--johnbot-chart-series-codex)"
            stroke="var(--johnbot-chart-series-codex)"
            isAnimationActive={false}
          />
        </Chart>
      </ChartContainer>
      {!data.length && <Text tone="muted">Sem dados neste recorte.</Text>}
    </section>
  );
}
function ProgramEntity({ props, kind }: RenderProps & { kind: string }) {
  const trigger = useTriggerAction();
  return (
    <Card data-testid={`openui-${kind.replace("Card", "-card").toLowerCase()}`} className="p-4">
      <Heading as="h3" size="sm">
        {props.name ?? props.title}
      </Heading>
      {[props.role, props.status, props.schedule, props.lastRun, props.summary]
        .filter(Boolean)
        .map((value, index) => (
          <Text key={index} as="p" variant="body-sm" tone="secondary">
            {value}
          </Text>
        ))}
      {props.action && kind !== "NotebookCard" && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => trigger(props.name ?? props.title, undefined, props.action)}
        >
          Abrir
        </Button>
      )}
    </Card>
  );
}

export function buildClientDashboardLibrary() {
  const views: Record<string, React.ComponentType<RenderProps>> = {
    Stack: (props) => <Layout {...props} kind="Stack" />,
    Row: (props) => <Layout {...props} kind="Row" />,
    Grid: (props) => <Layout {...props} kind="Grid" />,
    Card: (props) => (
      <Card data-testid="openui-card" className="p-4 min-w-0">
        {props.props.title && (
          <Heading as="h3" size="sm">
            {props.props.title}
          </Heading>
        )}
        {props.props.subtitle && (
          <Text as="p" tone="secondary">
            {props.props.subtitle}
          </Text>
        )}
        <div className="mt-3">{children(props)}</div>
      </Card>
    ),
    Text: ({ props }) => (
      <Text
        data-testid="openui-text"
        as="p"
        tone={
          props.variant === "error"
            ? "danger"
            : props.variant === "default"
              ? "primary"
              : props.variant
        }
        variant={props.size === "xs" ? "caption" : props.size === "sm" ? "body-sm" : "body"}
      >
        {props.content}
      </Text>
    ),
    Heading: ({ props }) => (
      <Heading
        data-testid="openui-heading"
        as={`h${Math.min(6, Math.max(1, props.level ?? 2))}` as "h2"}
      >
        {props.content}
      </Heading>
    ),
    Badge: ({ props }) => (
      <Badge
        data-testid="openui-badge"
        variant={
          props.variant === "success"
            ? "success-light"
            : props.variant === "warning"
              ? "warning-light"
              : props.variant
        }
      >
        {props.label}
      </Badge>
    ),
    Separator: ({ props }) => (
      <Separator data-testid="openui-separator" orientation={props.orientation} />
    ),
    Button: ProgramButton,
    Alert: ({ props }) => (
      <Alert
        data-testid="openui-alert"
        tone={props.variant === "destructive" ? "danger" : props.variant}
      >
        {props.title && <strong>{props.title}: </strong>}
        {props.message}
      </Alert>
    ),
    Progress: ({ props }) => (
      <Progress
        data-testid="openui-progress"
        aria-label={props.label ?? "Progresso"}
        value={props.value}
        maxValue={props.max ?? 100}
      />
    ),
    Input: (props) => <ProgramInput {...props} kind="Input" />,
    Textarea: (props) => <ProgramInput {...props} kind="Textarea" />,
    Select: (props) => <ProgramInput {...props} kind="Select" />,
    Checkbox: (props) => <ProgramInput {...props} kind="Checkbox" />,
    Switch: (props) => <ProgramInput {...props} kind="Switch" />,
    Slider: (props) => <ProgramInput {...props} kind="Slider" />,
    Tabs: ProgramTabs,
    Accordion: ({ props, renderNode }) => (
      <div>
        {props.items.map((item: any) => (
          <details key={item.id} className="settings-modal-card p-3">
            <summary>{item.title}</summary>
            {renderNode(item.content)}
          </details>
        ))}
      </div>
    ),
    Tooltip: (props) => (
      <MotionTooltip content={props.props.content}>
        <span>{children(props)}</span>
      </MotionTooltip>
    ),
    Avatar: ({ props }) => (
      <UserAvatar
        user={{ name: props.fallback ?? "JohnBot", email: "", avatarUrl: props.src ?? null }}
        className="ui-avatar"
      />
    ),
    Metric: ({ props }) => (
      <dl className="agent-usage-totals" data-testid="openui-metric">
        <div>
          <dt>{props.label}</dt>
          <dd>{scalar(props.value)}</dd>
          {props.delta && (
            <Text
              as="small"
              tone={
                props.deltaType === "negative"
                  ? "danger"
                  : props.deltaType === "positive"
                    ? "success"
                    : "muted"
              }
            >
              {props.delta}
            </Text>
          )}
        </div>
      </dl>
    ),
    Table: ProgramTable,
    BarChart: (props) => <ProgramChart {...props} area={false} />,
    AreaChart: (props) => <ProgramChart {...props} area />,
    RoutineCard: (props) => <ProgramEntity {...props} kind="RoutineCard" />,
    AgentCard: (props) => <ProgramEntity {...props} kind="AgentCard" />,
    NotebookCard: (props) => <ProgramEntity {...props} kind="NotebookCard" />,
  };
  return createLibrary({
    root: "Stack",
    components: dashboardComponents.map((definition) =>
      defineComponent({ ...definition, component: views[definition.name] }),
    ),
    actions: [...dashboardActions],
    functions: [...dashboardFunctions],
  });
}
const clientLibrary = buildClientDashboardLibrary();
export function DashboardProgram({
  program,
  state,
  routines,
  agents,
  onAction,
  onError,
}: DashboardProgramProps) {
  const validationError = useMemo(() => {
    try {
      validateDashboardProgram(program);
      return null;
    } catch (cause) {
      return cause instanceof Error ? cause.message : "Definição de dashboard inválida.";
    }
  }, [program]);
  useEffect(() => {
    if (validationError) onError?.(validationError);
  }, [validationError, onError]);
  const toolProvider = useMemo(
    () => ({
      dashboardData: async (args: Record<string, unknown>) =>
        dashboardSourceData(String(args.source), state, routines, agents),
    }),
    [state, routines, agents],
  );
  if (validationError)
    return (
      <Alert tone="danger" data-testid="dashboard-program-error">
        {validationError}
      </Alert>
    );
  return (
    <div data-testid="dashboard-program-root" className="min-w-0">
      <Renderer
        response={program}
        library={clientLibrary}
        onAction={onAction}
        toolProvider={toolProvider}
      />
    </div>
  );
}
