import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { transformMachineDowntime } from "../../lib/machine-downtime-analysis";
import { isWorkflowRunDetail, type WorkflowRunDetail } from "../../contracts/ipc";
import { workflowRunPageSchema } from "../../contracts/workspace-ui";
import { readDomain, updateDomain } from "../repositories/domain-store";
import { find, readStore, workflowsDomain, workflowsStoreSchema, seedWorkflows, recordsFor, replaceRecords } from "./workflows";
import { invalidInput } from "../errors";

export const csvRunInputSchema = z.object({ serverId: z.literal("local"), workflowId: z.literal("wf-machine-downtime-csv"), requestId: z.string().regex(/^[\w-]{1,128}$/u), fromNodeId: z.string().optional() }).strict();
export const csvRunResultSchema = z.custom<WorkflowRunDetail>(isWorkflowRunDetail);
const storedLayersSchema = z.object({ bronze: z.object({ csv: z.string(), sha256: z.string(), records: z.number(), columns: z.array(z.string()) }), silver: z.json(), gold: z.json() });
export async function readMachineLayers(sessionId: string, runId: string) {
  return readDomain(sessionId, `machine-downtime:${runId}`, storedLayersSchema, () => { throw invalidInput("Resultados não encontrados. Execute o workflow primeiro."); });
}
export async function executeMachineDowntime(sessionId: string, input: z.infer<typeof csvRunInputSchema>) {
  const workflow = find(await readStore(sessionId, input.serverId), input.workflowId).detail;
  const ids = ["csv-start", "csv-bronze", "csv-silver", "csv-gold", "csv-report"];
  if (workflow.graph.nodes.length !== ids.length || ids.some((id) => !workflow.graph.nodes.some((node) => node.id === id))) throw invalidInput("O executor Bronze/Prata/Ouro requer os cinco nós do pipeline original.");
  const domain = `workflow-runs:${input.serverId}:${input.workflowId}`;
  const empty = () => ({ runs: [], soloSteps: [], nextBefore: null });
  const page = await readDomain(sessionId, domain, workflowRunPageSchema, empty);
  const runId = `csv-${input.requestId}`;
  const previous = page.runs.find((entry) => entry.run.id === runId);
  if (previous) return previous;
  const startedAt = new Date().toISOString();
  const csv = await readFile(join(process.cwd(), "public/datasets/machine-downtime.csv"), "utf8");
  const layers = transformMachineDowntime(csv);
  if (!layers.silver.rows.length) throw invalidInput("Nenhum registro válido após a limpeza.");
  const sha256 = createHash("sha256").update(csv).digest("hex");
  await readDomain(sessionId, `machine-downtime:${runId}`, storedLayersSchema, () => ({ ...layers, bronze: { ...layers.bronze, sha256 } }));
  const download = (layer: string) => `/api/datasets/machine-downtime?run=${encodeURIComponent(runId)}&layer=${layer}`;
  const output = [
    "Pipeline determinístico iniciado sobre Machine Downtime.csv.",
    `BRONZE: ${layers.bronze.records} registros originais preservados. SHA-256: ${sha256}.\n\n[Baixar Bronze](${download("bronze")})`,
    `PRATA: ${layers.silver.rows.length} registros limpos; ${layers.silver.rejected.length} rejeitados; ${layers.silver.duplicates} duplicatas; ${layers.silver.missingValues} leituras ausentes preservadas. Datas ISO, sensores numéricos e nomes padronizados.\n\n[Baixar Prata](${download("silver")})`,
    `${layers.gold.report}\n\n[Baixar Ouro](${download("gold")})`,
    `Camadas e histórico persistidos no PostgreSQL.\n\n[Bronze CSV](${download("bronze")}) · [Prata JSON](${download("silver")}) · [Ouro JSON](${download("gold")}) · [Relatório](${download("report")})`,
  ];
  const endedAt = new Date().toISOString();
  const result: WorkflowRunDetail = {
    run: { id: runId, workflowId: input.workflowId, number: page.runs.length + 1, triggerNodeId: "csv-start", source: "manual", status: "done", error: null, startedAt, endedAt },
    steps: ids.map((nodeId, index) => ({ id: `${runId}-${nodeId}`, workflowId: input.workflowId, runId, nodeId, attempt: 1, agentId: null, status: "done", output: output[index], branch: null, error: null, startedAt, endedAt })),
  };
  const saved = await updateDomain(sessionId, domain, workflowRunPageSchema, empty, (current) => current.runs.some((entry) => entry.run.id === runId) ? current : { ...current, runs: [result, ...current.runs].slice(0, 100) });
  await updateDomain(sessionId, workflowsDomain, workflowsStoreSchema, seedWorkflows, (current) =>
    replaceRecords(current, input.serverId, recordsFor(current, input.serverId).map((record) => record.detail.summary.id === input.workflowId
      ? { ...record, detail: { ...record.detail, summary: { ...record.detail.summary, lastRun: { status: "done" as const, at: endedAt } } } }
      : record)),
  );
  return saved.runs.find((entry) => entry.run.id === runId)!;
}
