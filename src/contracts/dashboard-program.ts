import { createParser } from "@openuidev/lang-core";
import { dashboardLibrary, validateDashboardProgram } from "./dashboard-library";

/** Authorize program data bindings as well as legacy widgets at the write boundary. */
export function dashboardProgramSources(program: string): Set<string> {
  validateDashboardProgram(program);
  const parsed = createParser(dashboardLibrary.toJSONSchema()).parse(program);
  const sources = new Set<string>();
  for (const query of parsed.queryStatements) {
    if (query.argsAST?.k !== "Obj") continue;
    const source = query.argsAST.entries.find(([key]) => key === "source")?.[1];
    if (source?.k === "Str") sources.add(source.v);
  }
  return sources;
}
