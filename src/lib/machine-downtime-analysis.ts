/** Pure Bronze/Prata/Ouro processing of the supplied, unquoted telemetry CSV. */
export function transformMachineDowntime(csv: string) {
  const [header, ...lines] = csv.replace(/^\uFEFF/u, "").trimEnd().split(/\r?\n/u);
  const columns = header.split(",").map((value) => value.trim());
  if (columns.length !== 16 || columns[0] !== "Date" || columns[1] !== "Machine_ID" || columns[15] !== "Downtime") throw new Error("Schema Machine Downtime inválido.");
  const sensorNames = ["hydraulic_pressure_bar", "coolant_pressure_bar", "air_pressure_bar", "coolant_temperature_c", "hydraulic_oil_temperature_c", "spindle_bearing_temperature_c", "spindle_vibration_um", "tool_vibration_um", "spindle_speed_rpm", "voltage_v", "torque_nm", "cutting_kn"];
  const rows: { source_row: number; date: string; machine_id: string; assembly_line: string; downtime: string; sensors: Record<string, number | null> }[] = [];
  const rejected: { source_row: number; reason: string }[] = [], seen = new Set<string>();
  let duplicates = 0, missingValues = 0, blankRows = 0;
  lines.forEach((line, index) => {
    const source_row = index + 2, values = line.split(",").map((value) => value.trim());
    if (!line.trim()) { blankRows++; return; }
    const reject = (reason: string) => rejected.push({ source_row, reason });
    if (values.length !== 16) { reject("Número de colunas inválido"); return; }
    const match = /^(\d{2})-(\d{2})-(\d{4})$/u.exec(values[0]);
    const date = match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    const time = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) { reject("Data inválida"); return; }
    const downtime = values[15].toLowerCase();
    if (!values[1] || !values[2] || !["machine_failure", "no_machine_failure"].includes(downtime)) { reject("Máquina, linha ou classe inválida"); return; }
    const sensors: Record<string, number | null> = {}; let missing = 0;
    for (const [index, name] of sensorNames.entries()) {
      const raw = values[index + 3];
      if (!raw || /^(nan|null|na)$/iu.test(raw)) { sensors[name] = null; missing++; continue; }
      const value = Number(raw);
      if (!Number.isFinite(value)) { reject(`Sensor inválido: ${name}`); return; }
      sensors[name] = value;
    }
    const normalized = { date, machine_id: values[1], assembly_line: values[2], downtime, sensors };
    const key = JSON.stringify(normalized);
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key); missingValues += missing; rows.push({ source_row, ...normalized });
  });
  const aggregate = (key: "machine_id" | "assembly_line" | "date") => {
    const groups = new Map<string, { group: string; records: number; failures: number; failure_rate: number }>();
    for (const row of rows) {
      const group = key === "date" ? row.date.slice(0, 7) : row[key];
      const value = groups.get(group) ?? { group, records: 0, failures: 0, failure_rate: 0 };
      value.records++; if (row.downtime === "machine_failure") value.failures++; groups.set(group, value);
    }
    return [...groups.values()].map((value) => ({ ...value, failure_rate: value.failures / value.records })).sort((a, b) => b.failure_rate - a.failure_rate);
  };
  const failures = rows.filter((row) => row.downtime === "machine_failure").length;
  const byMachine = aggregate("machine_id"), byLine = aggregate("assembly_line"), byMonth = aggregate("date");
  const insights = [
    `${rows.length} registros válidos; ${failures} classificados como falha (${rows.length ? (failures / rows.length * 100).toFixed(1) : "0"}%).`,
    ...(byMachine[0] ? [`Maior frequência observada: ${byMachine[0].group}, ${(byMachine[0].failure_rate * 100).toFixed(1)}% em ${byMachine[0].records} registros.`] : []),
    `${rejected.length} linhas rejeitadas; ${duplicates} duplicatas exatas; ${missingValues} leituras ausentes preservadas como null.`,
    "Frequência descritiva, sem inferência causal. O arquivo não contém duração para calcular OEE, MTTR ou MTBF.",
  ];
  const report = `# Machine Downtime — Ouro\n\n${insights.join("\n\n")}\n\n| Máquina | Registros | Falhas | Taxa |\n| --- | ---: | ---: | ---: |\n${byMachine.map((value) => `| ${value.group} | ${value.records} | ${value.failures} | ${(value.failure_rate * 100).toFixed(1)}% |`).join("\n")}`;
  return { bronze: { csv, records: lines.length, columns }, silver: { rows, rejected, duplicates, missingValues, blankRows }, gold: { records: rows.length, failures, byMachine, byLine, byMonth, insights, report } };
}
