import { useState, type ReactNode } from "react";
import { Button } from "@johnbot/ui";
import type { OperationsChange } from "../../contracts/operations";

type Change = (change: OperationsChange["change"]) => Promise<boolean>;

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="agent-usage-table">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th scope="col" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, expanded ? undefined : 5).map((row, index) => (
            <tr key={index}>
              {row.map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 5 && (
        <Button
          variant="ghost"
          size="xs"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Mostrar menos" : `Ver todos (${rows.length})`}
        </Button>
      )}
      {!rows.length && (
        <p className="mt-3 text-sm opacity-60">Sem registros autorizados nesta visão.</p>
      )}
    </div>
  );
}

export { DataTable };
export type { Change };
