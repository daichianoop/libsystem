import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/server/supabase";

export async function GET() {
  const startTime = Date.now();

  try {
    const supabase = getAdminSupabase();
    // Verify DB reachability by checking checkpoints table
    const { error } = await supabase.from("checkpoints").select("id").limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      return NextResponse.json(
        {
          status: "degraded",
          version: "1.0.0",
          database: "unreachable",
          error: error.message,
          latencyMs,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: "healthy",
        version: "1.0.0",
        database: "connected",
        latencyMs,
        timezone: "Asia/Kolkata",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        version: "1.0.0",
        error: err?.message || "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
