import { strToU8, zipSync } from "fflate";

// Turns an archive dump payload ({ group: { table: rows[] } }) into a zip of JSON + CSV files.
type Rows = Record<string, unknown>[];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Rows): string {
  if (rows.length === 0) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
}

export function buildArchiveZip(
  dump: { id: string; created_at: string; counts: unknown; files: unknown },
  payload: Record<string, unknown>,
  fileLinks: { bucket: string; path: string; url: string | null }[],
): Uint8Array {
  const out: Record<string, Uint8Array> = {};
  for (const [group, tables] of Object.entries(payload)) {
    if (!tables || typeof tables !== "object" || Array.isArray(tables)) continue;
    for (const [table, rows] of Object.entries(tables as Record<string, unknown>)) {
      if (!Array.isArray(rows)) continue;
      out[`${group}/${table}.json`] = strToU8(JSON.stringify(rows, null, 1));
      const csv = toCsv(rows as Rows);
      if (csv) out[`${group}/${table}.csv`] = strToU8(csv);
    }
  }
  out["manifest.json"] = strToU8(JSON.stringify({ dump_id: dump.id, created_at: dump.created_at, generated_at: payload.generated_at, counts: dump.counts, files: fileLinks.map((f) => ({ bucket: f.bucket, path: f.path })) }, null, 2));
  out["README.txt"] = strToU8(
    "BoutCasts archive dump\n" +
      "Each folder holds one JSON and one CSV file per database table.\n" +
      "Video/audio clips are not inside this zip. Download them from the Archives page in Admin (their links expire after 1 hour),\n" +
      "then press 'Confirm downloaded and purge' to free space. Keep this zip: it is the only copy once you purge.\n",
  );
  return zipSync(out, { level: 6 });
}
