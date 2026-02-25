import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, AI_MODEL, calculateCost } from "@/lib/ai/client";
import { AI_TOOLS } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/tool-executor";
import { buildSystemPrompt } from "@/lib/ai/system-prompts";
import { buildContextData } from "@/lib/ai/context";
import { trackTokenUsage } from "@/lib/ai/token-tracker";
import type { PageContext, AIMessage } from "@/lib/ai/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get team_id
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!member) {
      return NextResponse.json({ error: "No team found" }, { status: 403 });
    }

    const body = await request.json();
    const {
      message,
      conversation_id,
      page_context = "home",
      campaign_id,
      history = [],
    } = body as {
      message: string;
      conversation_id?: string;
      page_context?: PageContext;
      campaign_id?: string;
      history?: AIMessage[];
    };

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const anthropic = getAnthropicClient();

    // Build system prompt with context
    const contextData = await buildContextData(
      page_context,
      member.team_id,
      campaign_id
    );
    const contextStr = `Current stats: ${JSON.stringify(contextData.stats || {})}`;
    const systemPrompt = buildSystemPrompt(page_context, contextStr);

    // Build messages array from history
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of history.slice(-20)) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: "user", content: message });

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = "";
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          const toolResults: { name: string; result: string }[] = [];

          // Initial API call
          const response = await anthropic.messages.create({
            model: AI_MODEL,
            max_tokens: 4096,
            system: systemPrompt,
            messages,
            tools: AI_TOOLS,
            stream: true,
          });

          let currentToolUse: {
            id: string;
            name: string;
            input: string;
          } | null = null;

          for await (const event of response) {
            if (event.type === "message_start") {
              totalInputTokens += event.message.usage?.input_tokens || 0;
            }
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: "",
                };
                // Send tool use start event
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "tool_start", name: event.content_block.name })}\n\n`
                  )
                );
              }
            }
            if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                fullResponse += event.delta.text;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text", content: event.delta.text })}\n\n`
                  )
                );
              }
              if (
                event.delta.type === "input_json_delta" &&
                currentToolUse
              ) {
                currentToolUse.input += event.delta.partial_json;
              }
            }
            if (event.type === "content_block_stop" && currentToolUse) {
              // Execute tool
              try {
                const toolInput = JSON.parse(currentToolUse.input || "{}");
                const result = await executeTool(
                  {
                    id: currentToolUse.id,
                    name: currentToolUse.name,
                    input: toolInput,
                  },
                  member.team_id,
                  user.id
                );
                toolResults.push({ name: currentToolUse.name, result });
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "tool_result", name: currentToolUse.name, result: JSON.parse(result) })}\n\n`
                  )
                );
              } catch (e) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "tool_error", name: currentToolUse.name, error: String(e) })}\n\n`
                  )
                );
              }
              currentToolUse = null;
            }
            if (event.type === "message_delta") {
              totalOutputTokens += event.usage?.output_tokens || 0;
            }
          }

          // Track token usage
          const costUsd = calculateCost(
            AI_MODEL,
            totalInputTokens,
            totalOutputTokens
          );
          await trackTokenUsage({
            teamId: member.team_id,
            userId: user.id,
            conversationId: conversation_id,
            modelId: AI_MODEL,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            endpoint: "chat",
          });

          // Send completion event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                usage: {
                  input_tokens: totalInputTokens,
                  output_tokens: totalOutputTokens,
                  cost_usd: costUsd,
                },
                tool_results: toolResults,
              })}\n\n`
            )
          );

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Internal server error: ${error instanceof Error ? error.message : "unknown"}`,
      },
      { status: 500 }
    );
  }
}
