import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    // Find the published proposal by slug
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, status")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (proposalError || !proposal) {
      return NextResponse.json(
        { error: "Proposal not found or not published" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      influencer_name,
      instagram_id,
      email,
      phone,
      paypal_email,
      shipping_address,
      message,
    } = body;

    const { data, error } = await supabase
      .from("proposal_responses")
      .insert({
        proposal_id: proposal.id,
        influencer_name: influencer_name || null,
        instagram_id: instagram_id || null,
        email: email || null,
        phone: phone || null,
        paypal_email: paypal_email || null,
        shipping_address: shipping_address || null,
        message: message || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: (data as { id: string }).id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
