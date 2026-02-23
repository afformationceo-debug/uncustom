import { NextResponse } from "next/server";
import { getSchemaForPlatform } from "@/lib/csv/platform-schemas";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? "instagram";

  const schema = getSchemaForPlatform(platform);

  // Row 1: Korean labels, Row 2: DB column names (for import parsing)
  const koreanRow = schema.map((col) => col.koreanLabel).join(",");
  const dbRow = schema.map((col) => col.dbColumn).join(",");

  // UTF-8 BOM for Excel Korean compatibility
  const BOM = "\uFEFF";
  const csvContent = BOM + koreanRow + "\n" + dbRow + "\n";

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="influencer_template_${platform}.csv"`,
    },
  });
}
