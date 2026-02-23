import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchemaForPlatform, type CsvColumnDef } from "@/lib/csv/platform-schemas";
import { detectApifyPlatform, isApifyCsv, mapApifyRow } from "@/lib/csv/apify-column-mapping";

const BATCH_SIZE = 500;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function convertValue(value: string, col: CsvColumnDef): unknown {
  if (!value || value === "-" || value === "") return null;
  switch (col.type) {
    case "number": {
      const n = Number(value.replace(/,/g, ""));
      return isNaN(n) ? null : n;
    }
    case "boolean":
      return value.toLowerCase() === "true" || value === "1" || value === "yes" || value === "예";
    case "date":
      return value;
    default:
      return value;
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const platformParam = (formData.get("platform") as string) ?? "instagram";

    if (!file) {
      return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: "최소 2줄 이상 필요합니다 (헤더 + 데이터)" }, { status: 400 });
    }

    // Parse first row as potential header
    const firstRowCells = parseCsvLine(lines[0]);

    // --- Apify CSV auto-detection ---
    if (isApifyCsv(firstRowCells)) {
      const detectedPlatform = detectApifyPlatform(firstRowCells) ?? platformParam;
      return await processApifyCsv(lines, firstRowCells, detectedPlatform);
    }

    // --- Standard uncustom CSV format ---
    return await processStandardCsv(lines, platformParam);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[csv/import] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Process Apify-format CSV: auto-map Apify column names to DB columns
 */
async function processApifyCsv(
  lines: string[],
  headers: string[],
  platform: string,
) {
  const supabase = await createClient();
  const dataLines = lines.slice(1);

  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  const batch: Record<string, unknown>[] = [];

  for (const line of dataLines) {
    const cells = parseCsvLine(line);
    if (cells.length < 2) continue;

    // Build raw header→value map
    const rawRow: Record<string, string> = {};
    for (let i = 0; i < headers.length && i < cells.length; i++) {
      rawRow[headers[i]] = cells[i];
    }

    const mapped = mapApifyRow(rawRow, platform);

    // Require at least username or platform_id
    if (!mapped.username && !mapped.platform_id) {
      skipped++;
      continue;
    }

    // Generate platform_id from username if missing
    if (!mapped.platform_id && mapped.username) {
      mapped.platform_id = mapped.username as string;
    }

    batch.push(mapped);

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from("influencers")
        .upsert(batch as never[], { onConflict: "platform,platform_id" });
      if (error) {
        console.error("[csv/import] Apify batch upsert error:", error.message);
        errors += batch.length;
      } else {
        upserted += batch.length;
      }
      batch.length = 0;
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const { error } = await supabase
      .from("influencers")
      .upsert(batch as never[], { onConflict: "platform,platform_id" });
    if (error) {
      console.error("[csv/import] Apify final batch error:", error.message);
      errors += batch.length;
    } else {
      upserted += batch.length;
    }
  }

  return NextResponse.json({
    total_parsed: dataLines.length,
    upserted,
    skipped,
    errors,
    platform,
    format: "apify",
    message: `Apify ${platform} CSV 자동 감지 — ${upserted}명 임포트 완료`,
  });
}

/**
 * Process standard uncustom CSV format (Korean labels or DB column names)
 */
async function processStandardCsv(lines: string[], platform: string) {
  const schema = getSchemaForPlatform(platform);
  const koreanLabels = schema.map((c) => c.koreanLabel);
  const dbColumns = schema.map((c) => c.dbColumn);

  // Find header row: try to match DB column names first, then Korean labels
  let headerRow = -1;
  let columnMap: string[] = [];

  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const cells = parseCsvLine(lines[i]);
    // Check if this row contains DB column names
    const matchesDb = cells.filter((c) => dbColumns.includes(c)).length;
    if (matchesDb >= 3) {
      headerRow = i;
      columnMap = cells;
      break;
    }
    // Check if this row contains Korean labels
    const matchesKo = cells.filter((c) => koreanLabels.includes(c)).length;
    if (matchesKo >= 3) {
      // Map Korean labels to DB column names
      headerRow = i;
      columnMap = cells.map((cell) => {
        const idx = koreanLabels.indexOf(cell);
        return idx >= 0 ? dbColumns[idx] : cell;
      });
      break;
    }
  }

  if (headerRow === -1) {
    // Assume first row is Korean labels (skip), second row is DB columns
    if (lines.length >= 3) {
      const secondRow = parseCsvLine(lines[1]);
      const matchesDb = secondRow.filter((c) => dbColumns.includes(c)).length;
      if (matchesDb >= 3) {
        headerRow = 1;
        columnMap = secondRow;
      }
    }
    if (headerRow === -1) {
      return NextResponse.json({
        error: "헤더를 찾을 수 없습니다. 템플릿을 사용하거나 Apify에서 다운로드한 CSV를 그대로 업로드해주세요.",
      }, { status: 400 });
    }
  }

  const dataLines = lines.slice(headerRow + 1);
  const supabase = await createClient();

  let upserted = 0;
  let errors = 0;
  const batch: Record<string, unknown>[] = [];

  for (const line of dataLines) {
    const cells = parseCsvLine(line);
    // Skip rows that look like Korean label headers
    if (cells[0] && koreanLabels.includes(cells[0])) continue;
    if (cells.length < 2) continue;

    const row: Record<string, unknown> = { platform };
    for (let i = 0; i < columnMap.length; i++) {
      const dbCol = columnMap[i];
      const schemaCol = schema.find((c) => c.dbColumn === dbCol);
      if (schemaCol && cells[i] !== undefined) {
        const val = convertValue(cells[i], schemaCol);
        if (val !== null) row[dbCol] = val;
      }
    }

    // Require at least username or platform_id
    if (!row.username && !row.platform_id) continue;
    if (!row.platform) row.platform = platform;

    batch.push(row);

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase
        .from("influencers")
        .upsert(batch as never[], { onConflict: "platform,platform_id" });
      if (error) {
        console.error("[csv/import] Batch upsert error:", error.message);
        errors += batch.length;
      } else {
        upserted += batch.length;
      }
      batch.length = 0;
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const { error } = await supabase
      .from("influencers")
      .upsert(batch as never[], { onConflict: "platform,platform_id" });
    if (error) {
      console.error("[csv/import] Final batch error:", error.message);
      errors += batch.length;
    } else {
      upserted += batch.length;
    }
  }

  return NextResponse.json({
    total_parsed: dataLines.length,
    upserted,
    errors,
    platform,
    format: "standard",
  });
}
