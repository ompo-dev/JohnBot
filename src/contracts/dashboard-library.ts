import { z } from "zod/v4";
import {
  createLibrary,
  defineComponent,
  defineAction,
  defineFunction,
  action,
  createParser,
  markReactive,
} from "@openuidev/lang-core";

export function reactive<T extends object>(schema: T): T {
  markReactive(schema);
  return schema;
}

// Custom Actions
export const OpenRoutineAction = defineAction({
  name: "OpenRoutine",
  description: "Open a routine workflow by its identifier",
  params: z.object({
    id: z.string(),
  }),
});

export const RunRoutineAction = defineAction({
  name: "RunRoutine",
  description: "Trigger/execute a routine workflow by its identifier",
  params: z.object({
    id: z.string(),
  }),
});

export const OpenAgentAction = defineAction({
  name: "OpenAgent",
  description: "Open an agent detail view by its identifier",
  params: z.object({
    id: z.string(),
  }),
});

export const OpenNotebookAction = defineAction({
  name: "OpenNotebook",
  description: "Open an investigation notebook by its identifier",
  params: z.object({
    id: z.string(),
  }),
});

export const NavigateAction = defineAction({
  name: "Navigate",
  description: "Navigate to an operations page or route",
  params: z.object({
    page: z.string(),
  }),
});

export const RefreshAction = defineAction({
  name: "Refresh",
  description: "Refresh the current dashboard data",
  params: z.object({}),
});

export const dashboardActions = [
  OpenRoutineAction,
  RunRoutineAction,
  OpenAgentAction,
  NavigateAction,
  RefreshAction,
] as const;

// Custom Pure Functions
export const WhereFunction = defineFunction({
  name: "Where",
  description: "Filter array of records where field matches value",
  params: z.object({
    rows: z.array(z.any()),
    field: z.string(),
    value: z.any(),
  }),
  fn: ({ rows, field, value }) => {
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => r?.[field] === value);
  },
});

export const TakeFunction = defineFunction({
  name: "Take",
  description: "Take the first N records from an array",
  params: z.object({
    rows: z.array(z.any()),
    count: z.number(),
  }),
  fn: ({ rows, count }) => {
    if (!Array.isArray(rows)) return [];
    const limit = typeof count === "number" && count >= 0 ? count : 0;
    return rows.slice(0, limit);
  },
});

export const PercentFunction = defineFunction({
  name: "Percent",
  description: "Format a number or decimal as a percentage string",
  params: z.object({
    value: z.number(),
    decimals: z.number().optional(),
  }),
  fn: ({ value, decimals = 1 }) => {
    if (typeof value !== "number" || isNaN(value)) return "0%";
    const d = typeof decimals === "number" ? decimals : 1;
    return (value * 100).toFixed(d) + "%";
  },
});

export const dashboardFunctions = [WhereFunction, TakeFunction, PercentFunction] as const;

// 25+ Component Definitions (Atoms, Molecules, Domain)
export const StackComponent = defineComponent({
  name: "Stack",
  description: "Vertical or horizontal layout container",
  props: z.object({
    children: z.array(z.any()).optional(),
    direction: z.enum(["vertical", "horizontal"]).optional(),
    gap: z.string().optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    justify: z.enum(["start", "center", "end", "between", "around"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const RowComponent = defineComponent({
  name: "Row",
  description: "Horizontal flex row layout",
  props: z.object({
    children: z.array(z.any()).optional(),
    gap: z.string().optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    justify: z.enum(["start", "center", "end", "between", "around"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const GridComponent = defineComponent({
  name: "Grid",
  description: "Grid layout container",
  props: z.object({
    children: z.array(z.any()).optional(),
    columns: z.number().optional(),
    gap: z.string().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const CardComponent = defineComponent({
  name: "Card",
  description: "Panel container with optional title and subtitle",
  props: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    children: z.array(z.any()).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const TextComponent = defineComponent({
  name: "Text",
  description: "Typography paragraph or label",
  props: z.object({
    content: z.string(),
    variant: z.enum(["default", "muted", "error", "success", "warning"]).optional(),
    size: z.enum(["xs", "sm", "base", "lg", "xl"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const HeadingComponent = defineComponent({
  name: "Heading",
  description: "Heading title (levels 1-6)",
  props: z.object({
    content: z.string(),
    level: z.number().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const BadgeComponent = defineComponent({
  name: "Badge",
  description: "Badge chip or status pill",
  props: z.object({
    label: z.string(),
    variant: z
      .enum(["default", "secondary", "destructive", "outline", "success", "warning"])
      .optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const SeparatorComponent = defineComponent({
  name: "Separator",
  description: "Visual divider separator",
  props: z.object({
    orientation: z.enum(["horizontal", "vertical"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const ButtonComponent = defineComponent({
  name: "Button",
  description: "Interactive button with click action",
  props: z.object({
    label: z.string(),
    action: action().optional(),
    variant: z.enum(["default", "secondary", "destructive", "outline", "ghost", "link"]).optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const AlertComponent = defineComponent({
  name: "Alert",
  description: "Callout notification banner",
  props: z.object({
    message: z.string(),
    title: z.string().optional(),
    variant: z.enum(["info", "success", "warning", "destructive"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const ProgressComponent = defineComponent({
  name: "Progress",
  description: "Linear progress indicator",
  props: z.object({
    value: z.number(),
    max: z.number().optional(),
    label: z.string().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const InputComponent = defineComponent({
  name: "Input",
  description: "Single-line text input field",
  props: z.object({
    name: z.string().optional(),
    value: reactive(z.string().optional()),
    placeholder: z.string().optional(),
    type: z.string().optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const TextareaComponent = defineComponent({
  name: "Textarea",
  description: "Multi-line text area input",
  props: z.object({
    name: z.string().optional(),
    value: reactive(z.string().optional()),
    placeholder: z.string().optional(),
    rows: z.number().optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const SelectComponent = defineComponent({
  name: "Select",
  description: "Select dropdown picker",
  props: z.object({
    name: z.string().optional(),
    value: reactive(z.string().optional()),
    options: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    placeholder: z.string().optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const CheckboxComponent = defineComponent({
  name: "Checkbox",
  description: "Checkbox input toggle",
  props: z.object({
    name: z.string().optional(),
    checked: reactive(z.boolean().optional()),
    label: z.string().optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const SwitchComponent = defineComponent({
  name: "Switch",
  description: "Switch toggle control",
  props: z.object({
    name: z.string().optional(),
    checked: reactive(z.boolean().optional()),
    label: z.string().optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const SliderComponent = defineComponent({
  name: "Slider",
  description: "Range slider input",
  props: z.object({
    name: z.string().optional(),
    value: reactive(z.number().optional()),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    disabled: z.boolean().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const TabsComponent = defineComponent({
  name: "Tabs",
  description: "Tab navigation container",
  props: z.object({
    tabs: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        content: z.any().optional(),
      }),
    ),
    activeTab: reactive(z.string().optional()),
    className: z.string().optional(),
  }),
  component: null,
});

export const AccordionComponent = defineComponent({
  name: "Accordion",
  description: "Collapsible accordion panels",
  props: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.any().optional(),
      }),
    ),
    className: z.string().optional(),
  }),
  component: null,
});

export const TooltipComponent = defineComponent({
  name: "Tooltip",
  description: "Hover tooltip label",
  props: z.object({
    content: z.string(),
    children: z.array(z.any()).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const AvatarComponent = defineComponent({
  name: "Avatar",
  description: "User avatar display",
  props: z.object({
    src: z.string().optional(),
    fallback: z.string().optional(),
    size: z.enum(["sm", "base", "lg", "xl"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const MetricComponent = defineComponent({
  name: "Metric",
  description: "Key performance metric card",
  props: z.object({
    label: z.string(),
    value: z.any(),
    delta: z.string().optional(),
    deltaType: z.enum(["positive", "negative", "neutral"]).optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const TableComponent = defineComponent({
  name: "Table",
  description: "Tabular data display",
  props: z.object({
    data: z.array(z.any()),
    columns: z
      .array(
        z.object({
          key: z.string(),
          header: z.string(),
        }),
      )
      .optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const BarChartComponent = defineComponent({
  name: "BarChart",
  description: "Bar chart visualization",
  props: z.object({
    data: z.array(z.any()),
    xKey: z.string().optional(),
    yKey: z.string().optional(),
    title: z.string().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const AreaChartComponent = defineComponent({
  name: "AreaChart",
  description: "Area chart visualization",
  props: z.object({
    data: z.array(z.any()),
    xKey: z.string().optional(),
    yKey: z.string().optional(),
    title: z.string().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const RoutineCardComponent = defineComponent({
  name: "RoutineCard",
  description: "Workflow routine status card",
  props: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string().optional(),
    schedule: z.string().optional(),
    lastRun: z.string().optional(),
    action: action().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const AgentCardComponent = defineComponent({
  name: "AgentCard",
  description: "Client agent summary card",
  props: z.object({
    id: z.string(),
    name: z.string(),
    role: z.string().optional(),
    status: z.string().optional(),
    model: z.string().optional(),
    action: action().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const NotebookCardComponent = defineComponent({
  name: "NotebookCard",
  description: "Read-only authorized execution summary from internal agent records",
  props: z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    updatedAt: z.string().optional(),
    action: action().optional(),
    className: z.string().optional(),
  }),
  component: null,
});

export const dashboardComponents = [
  StackComponent,
  RowComponent,
  GridComponent,
  CardComponent,
  TextComponent,
  HeadingComponent,
  BadgeComponent,
  SeparatorComponent,
  ButtonComponent,
  AlertComponent,
  ProgressComponent,
  InputComponent,
  TextareaComponent,
  SelectComponent,
  CheckboxComponent,
  SwitchComponent,
  SliderComponent,
  TabsComponent,
  AccordionComponent,
  TooltipComponent,
  AvatarComponent,
  MetricComponent,
  TableComponent,
  BarChartComponent,
  AreaChartComponent,
  RoutineCardComponent,
  AgentCardComponent,
  NotebookCardComponent,
] as const;

export const dashboardLibrary = createLibrary({
  root: "Stack",
  components: dashboardComponents as unknown as any[],
  actions: dashboardActions as unknown as any[],
  functions: dashboardFunctions as unknown as any[],
});

export const dashboardLibraryPrompt = dashboardLibrary.prompt({
  tools: [{ name: "dashboardData", description: "Read current authorized dashboard data. Never mutate.", inputSchema: {type:"object", properties:{source:{type:"string", enum:["person","machines","quality","actions","notebooks","routines","agents"]}},required:["source"],additionalProperties:false}, outputSchema:{type:"array",items:{type:"object"}}, annotations:{readOnlyHint:true} }],
  toolCalls: true,
  bindings: true,
  builtinFunctions: true,
  additionalRules: [
    "The root component is Stack: root = Stack([...]). There is NO Root component. Define referenced variables before their use.",
    "Every changing metric, chart and table must use Query(\"dashboardData\", {source: ...}). Do not embed snapshots or invent IDs. Use only supplied agent and routine IDs.",
    "Queries are read-only. Mutation and OpenUrl are forbidden. Notebooks are internal agent records; show only relevant authorized summaries, never an editor or a public notebook page.",
  ],
  toolExamples: ['quality = Query("dashboardData", {source:"quality"})\nmachines = Query("dashboardData", {source:"machines"})\nroot = Stack([Heading("Qualidade"), Grid([Card("Registros", "Fonte atual", [Table(quality)]), Card("Falhas por máquina", "Frequência observada", [BarChart(machines, "group", "failure_rate")])], 2)])'],
});

const MAX_PROGRAM_LENGTH = 64000;
const MAX_STATEMENTS = 200;
const MAX_AST_NODES = 4000;
const MAX_AST_DEPTH = 32;
const ALLOWED_QUERY_SOURCES = new Set([
  "person",
  "machines",
  "quality",
  "actions",
  "notebooks",
  "routines",
  "agents",
]);

const dashboardSchema = dashboardLibrary.toJSONSchema();
const dashboardParser = createParser(dashboardSchema);

export function validateDashboardProgram(program: string): void {
  if (typeof program !== "string") {
    throw new Error("Program must be a string");
  }

  if (program.length > MAX_PROGRAM_LENGTH) {
    throw new Error(
      `Program exceeds maximum length of ${MAX_PROGRAM_LENGTH} characters (length: ${program.length})`,
    );
  }

  const parseResult = dashboardParser.parse(program);

  if (parseResult.meta.incomplete) {
    throw new Error("Incomplete dashboard program");
  }

  if (parseResult.meta.errors && parseResult.meta.errors.length > 0) {
    const errMessages = parseResult.meta.errors.map((e) => e.message).join("; ");
    throw new Error(`Invalid program: ${errMessages}`);
  }
  if (!program.trim() || !parseResult.root) throw new Error("Empty dashboard program");

  if (parseResult.meta.unresolved && parseResult.meta.unresolved.length > 0) {
    throw new Error(`Unresolved identifiers: ${parseResult.meta.unresolved.join(", ")}`);
  }

  if (parseResult.meta.statementCount > MAX_STATEMENTS) {
    throw new Error(
      `Program exceeds maximum statement count of ${MAX_STATEMENTS} (got ${parseResult.meta.statementCount})`,
    );
  }

  if (parseResult.mutationStatements && parseResult.mutationStatements.length > 0) {
    throw new Error("Mutation calls are forbidden in dashboard programs");
  }

  // Count AST nodes, depth & check for cycles
  let totalNodeCount = 0;
  const visited = new Set<object>();
  const activeStack = new Set<object>();

  function traverse(obj: any, depth = 1) {
    if (!obj || typeof obj !== "object") return;

    if (depth > MAX_AST_DEPTH) {
      throw new Error(`Program AST exceeds maximum depth (${MAX_AST_DEPTH})`);
    }

    if (activeStack.has(obj)) {
      throw new Error("Cycle detected in AST");
    }

    if (visited.has(obj)) return;
    visited.add(obj);
    activeStack.add(obj);

    totalNodeCount++;
    if (totalNodeCount > MAX_AST_NODES) {
      throw new Error(
        `Program exceeds maximum AST node count of ${MAX_AST_NODES} (got > ${MAX_AST_NODES})`,
      );
    }

    // Traverse component type validation if it's an element
    if (obj.type === "element" && obj.typeName) {
      if (!dashboardLibrary.components?.[obj.typeName]) {
        throw new Error(`Unknown component: ${obj.typeName}`);
      }
    }

    if (obj.k === "RuntimeRef" && obj.refType === "mutation") {
      throw new Error("Mutation calls are forbidden in dashboard programs");
    }

    if (obj.k === "Comp" && obj.name) {
      const isKnownComp = !!dashboardLibrary.components?.[obj.name];
      const isKnownAction = !!dashboardLibrary.actions?.[obj.name];
      const isKnownFunc =
        !!dashboardLibrary.functions?.[obj.name] ||
        [
          "Count",
          "First",
          "Last",
          "Sum",
          "Avg",
          "Min",
          "Max",
          "Sort",
          "Filter",
          "Round",
          "Abs",
          "Floor",
          "Ceil",
          "Each",
        ].includes(obj.name);
      const isBuiltinAction = ["Run", "ToAssistant", "OpenUrl", "Set", "Reset"].includes(obj.name);

      if (!isKnownComp && !isKnownAction && !isKnownFunc && !isBuiltinAction) {
        throw new Error(`Unknown component or action: ${obj.name}`);
      }
    }

    for (const key of Object.keys(obj)) {
      traverse(obj[key], depth + 1);
    }

    activeStack.delete(obj);
  }

  traverse(parseResult, 1);

  for (const q of parseResult.queryStatements) {
    // toolAST must be 'dashboardData'
    const toolName = q.toolAST?.k === "Str" ? q.toolAST.v : null;
    if (toolName !== "dashboardData") {
      throw new Error(`Invalid query tool: ${toolName}. Only dashboardData is allowed.`);
    }

    // argsAST must have source in allowed list
    let sourceValue: string | null = null;
    if (q.argsAST?.k === "Obj" && Array.isArray(q.argsAST.entries)) {
      const sourceEntry = q.argsAST.entries.find(([key]: [string, any]) => key === "source");
      if (sourceEntry && sourceEntry[1]?.k === "Str") {
        sourceValue = sourceEntry[1].v;
      }
    }

    if (!sourceValue || !ALLOWED_QUERY_SOURCES.has(sourceValue)) {
      throw new Error(`Invalid query source: ${sourceValue}`);
    }
  }
}
