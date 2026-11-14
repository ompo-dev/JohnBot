import { readMachineLayers } from "../../../../server/services/machine-downtime";
import { readSession, attachSessionCookie } from "../../../../server/http/session";
import { errorResponse } from "../../../../server/http/responses";
import { requestId } from "../../../../server/http/request";
import { invalidInput } from "../../../../server/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url), run = url.searchParams.get("run") ?? "", layer = url.searchParams.get("layer") ?? "gold";
    if (!/^[\w-]{1,160}$/u.test(run) || !["bronze", "silver", "gold", "report"].includes(layer)) throw invalidInput("Camada ou execução inválida.");
    const session = await readSession(), data = await readMachineLayers(session.sessionId, run);
    const report = (data.gold as { report: string }).report;
    const content = layer === "bronze" ? data.bronze.csv : layer === "report" ? report : JSON.stringify(layer === "silver" ? data.silver : data.gold, null, 2);
    const ext = layer === "bronze" ? "csv" : layer === "report" ? "md" : "json";
    const response = new NextResponse(content, { headers: { "Content-Type": `${layer === "bronze" ? "text/csv" : layer === "report" ? "text/markdown" : "application/json"}; charset=utf-8`, "Content-Disposition": `attachment; filename="machine-downtime-${layer}.${ext}"`, "Cache-Control": "private, no-store" } });
    attachSessionCookie(response, session);
    return response;
  } catch (error) { return errorResponse(error, requestId(request)); }
}
