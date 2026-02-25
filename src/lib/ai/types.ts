export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tool_calls?: AIToolCall[];
  tool_results?: AIToolResult[];
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResult {
  tool_call_id: string;
  content: string;
  is_error?: boolean;
}

export interface AIConversation {
  id: string;
  user_id: string;
  team_id: string;
  page_context: string | null;
  campaign_id: string | null;
  title: string | null;
  messages: AIMessage[];
  model_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
}

export interface AIAction {
  id: string;
  team_id: string;
  conversation_id: string | null;
  action_type: AIActionType;
  action_payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
}

export type AIActionType =
  | 'assign_campaign'
  | 'send_email'
  | 'update_status'
  | 'create_proposal'
  | 'start_extraction';

export interface AIInsight {
  id: string;
  team_id: string;
  campaign_id: string | null;
  insight_type: 'trend_alert' | 'anomaly' | 'opportunity' | 'bottleneck' | 'recommendation';
  priority: 'low' | 'normal' | 'high' | 'critical';
  title: string;
  body: string;
  data: Record<string, unknown>;
  page_context: string | null;
  dismissed: boolean;
  is_read: boolean;
  is_pinned: boolean;
}

export interface AIContextData {
  page: string;
  teamId: string;
  campaignId?: string;
  stats?: Record<string, unknown>;
}

export interface AITokenUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export type PageContext =
  | 'master'
  | 'campaigns'
  | 'manage'
  | 'brands'
  | 'content-analysis'
  | 'commerce'
  | 'templates'
  | 'email-send'
  | 'contents'
  | 'metrics'
  | 'home';
