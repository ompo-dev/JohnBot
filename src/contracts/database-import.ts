import { Schema } from "effect";

export const DATABASE_IMPORT_PACKET_BYTES = 32 * 1024 * 1024;
const Count = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const Hex = Schema.String.check(Schema.isPattern(/^(?:[0-9a-f]{2})*$/u));
const Digest = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));

/** Text and blobs retain their SQLite bytes; integers never pass through a JSON number. */
export const DatabaseImportCell = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("null"), value: Schema.Literal("") }),
  Schema.Struct({ kind: Schema.Literal("integer"), value: Schema.String.check(Schema.isPattern(/^-?\d+$/u)) }),
  Schema.Struct({ kind: Schema.Literal("real"), value: Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/u)) }),
  Schema.Struct({ kind: Schema.Literals(["text", "blob"]), value: Hex }),
]);
export type DatabaseImportCell = typeof DatabaseImportCell.Type;

const DatabaseImportColumn = Schema.Struct({
  cid: Schema.Number.check(Schema.isInt()),
  name: Schema.String,
  type: Schema.String,
  notnull: Count,
  dflt_value: Schema.NullOr(Schema.String),
  pk: Count,
  hidden: Count,
});

export const DatabaseImportPacket = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("schema"),
    version: Schema.Literal(1),
    sourceVersions: Schema.Array(Count),
    objects: Schema.Array(
      Schema.Struct({
        type: Schema.String,
        name: Schema.String,
        tbl_name: Schema.String,
        sql: Schema.NullOr(Schema.String),
      }),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("table"),
    name: Schema.String,
    tableType: Schema.Literals(["table", "virtual", "shadow"]),
    rowId: Schema.NullOr(Schema.String),
    columns: Schema.Array(DatabaseImportColumn),
  }),
  Schema.Struct({
    kind: Schema.Literal("rows"),
    table: Schema.String,
    start: Count,
    rows: Schema.Array(Schema.Array(DatabaseImportCell)),
  }),
  Schema.Struct({ kind: Schema.Literal("finished"), tables: Count, rows: Count, packets: Count, checksum: Digest }),
]);
export type DatabaseImportPacket = typeof DatabaseImportPacket.Type;

export const DatabaseImportReceipt = Schema.Struct({
  version: Schema.Literal(1),
  schema: Schema.String,
  sourceVersions: Schema.Array(Count),
  tables: Count,
  rows: Count,
  packets: Count,
  checksum: Digest,
});
export type DatabaseImportReceipt = typeof DatabaseImportReceipt.Type;
