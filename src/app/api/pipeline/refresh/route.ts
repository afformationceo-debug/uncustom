import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entity_type");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

    let query = supabase
      .from("data_refresh_jobs")
      .select("*")
      .order("priority", { ascending: true })
      .order("next_refresh_at", { ascending: true })
      .limit(limit);

    if (entityType) query = query.eq("entity_type", entityType);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      entity_type,
      entity_id,
      refresh_interval_hours = 168,
      priority = 5,
    } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: "entity_type and entity_id are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) {
      return NextResponse.json({ error: "Team not found" }, { status: 403 });
    }

    const nextRefresh = new Date();
    nextRefresh.setHours(nextRefresh.getHours() + refresh_interval_hours);

    const { data, error } = await supabase
      .from("data_refresh_jobs")
      .upsert(
        {
          team_id: member.team_id,
          entity_type,
          entity_id,
          refresh_interval_hours,
          priority,
          status: "scheduled",
          next_refresh_at: nextRefresh.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "team_id,entity_type,entity_id" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Run due refresh jobs */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { action } = body;

    if (action === "run_due") {
      // Find jobs that are due for refresh
      const now = new Date().toISOString();
      const { data: dueJobs, error } = await supabase
        .from("data_refresh_jobs")
        .select("*")
        .eq("status", "scheduled")
        .lte("next_refresh_at", now)
        .order("priority", { ascending: true })
        .limit(10);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      // Mark as queued
      const jobs = (dueJobs ?? []) as Tables<"data_refresh_jobs">[];
      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length > 0) {
        await supabase
          .from("data_refresh_jobs")
          .update({ status: "queued", updated_at: now })
          .in("id", jobIds);
      }

      return NextResponse.json({
        queued: jobIds.length,
        jobs,
      });
    }

    if (action === "complete") {
      const { job_id, actual_cost_usd } = body;
      if (!job_id) {
        return NextResponse.json({ error: "job_id required" }, { status: 400 });
      }

      const now = new Date();
      const { data: jobRaw } = await supabase
        .from("data_refresh_jobs")
        .select("refresh_interval_hours")
        .eq("id", job_id)
        .single();

      const jobRecord = jobRaw as { refresh_interval_hours: number } | null;
      const nextRefresh = new Date();
      nextRefresh.setHours(
        nextRefresh.getHours() + (jobRecord?.refresh_interval_hours ?? 168)
      );

      const { error } = await supabase
        .from("data_refresh_jobs")
        .update({
          status: "scheduled",
          last_refresh_at: now.toISOString(),
          next_refresh_at: nextRefresh.toISOString(),
          actual_cost_usd: actual_cost_usd ?? null,
          updated_at: now.toISOString(),
        })
        .eq("id", job_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
