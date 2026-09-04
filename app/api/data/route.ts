import { NextResponse } from "next/server";
import { loadData } from "@/lib/data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { map, sentiment } = await loadData();
    return NextResponse.json({ map, sentiment });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load major map" },
      { status: 500 },
    );
  }
}
