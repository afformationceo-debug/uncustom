"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { DmEditor } from "@/components/templates/dm-editor";
import { EmailEditor } from "@/components/templates/email-editor";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  MessageSquare,
  Mail,
  Loader2,
  Search,
  ArrowLeft,
  Calendar,
  Sparkles,
  LayoutTemplate,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/types/database";

type EmailTemplate = Tables<"email_templates">;
type Campaign = Tables<"campaigns">;
type Proposal = Tables<"proposals">;

type TemplateType = "dm" | "email";

/** Template with joined campaign name for the overview grid */
interface TemplateWithCampaign extends EmailTemplate {
  campaign_name: string;
}

interface FormState {
  name: string;
  type: TemplateType;
  roundNumber: number;
  dmBody: string;
  subject: string;
  bodyHtml: string;
  senderName: string;
  senderEmail: string;
  proposalId: string | null;
}

const INITIAL_FORM: FormState = {
  name: "",
  type: "dm",
  roundNumber: 1,
  dmBody: "",
  subject: "",
  bodyHtml: "",
  senderName: "",
  senderEmail: "",
  proposalId: null,
};

export default function TemplatesPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">...</div>
      }
    >
      <TemplatesPage />
    </Suspense>
  );
}

function TemplatesPage() {
  const supabase = createClient();

  // ---- Data state ----
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allTemplates, setAllTemplates] = useState<TemplateWithCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Filter state (overview) ----
  const [typeFilter, setTypeFilter] = useState<"all" | TemplateType>("all");
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ---- Create dialog state ----
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createCampaignId, setCreateCampaignId] = useState<string | null>(null);
  const [createType, setCreateType] = useState<TemplateType>("dm");

  // ---- Editor state ----
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editorCampaignId, setEditorCampaignId] = useState<string | null>(null);
  const [editorCampaignName, setEditorCampaignName] = useState("");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  // ---- Proposals for editor ----
  const [proposals, setProposals] = useState<Proposal[]>([]);

  // ---- Delete state ----
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  // ===== Fetch campaigns + team info on mount =====
  useEffect(() => {
    async function fetchInitial() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (!memberData) return;

      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("*")
        .eq("team_id", memberData.team_id)
        .order("created_at", { ascending: false });
      if (campaignData) setCampaigns(campaignData as Campaign[]);
    }
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Fetch ALL templates across all campaigns for this team =====
  const fetchAllTemplates = useCallback(async () => {
    if (campaigns.length === 0) {
      setAllTemplates([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const campaignIds = campaigns.map((c) => c.id);
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("템플릿 로드 실패");
      setAllTemplates([]);
    } else {
      const templatesWithCampaign: TemplateWithCampaign[] = (
        (data as EmailTemplate[]) ?? []
      ).map((t) => ({
        ...t,
        campaign_name: campaignMap.get(t.campaign_id) ?? "알 수 없음",
      }));
      setAllTemplates(templatesWithCampaign);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns]);

  useEffect(() => {
    fetchAllTemplates();
  }, [fetchAllTemplates]);

  // ===== Realtime: listen to all template changes (no campaign filter) =====
  useRealtime("email_templates", undefined, fetchAllTemplates);

  // ===== Filtered templates for the grid =====
  const filteredTemplates = useMemo(() => {
    let result = allTemplates;

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((t) => (t.type || "email") === typeFilter);
    }

    // Campaign filter
    if (campaignFilter) {
      result = result.filter((t) => t.campaign_id === campaignFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.name ?? "").toLowerCase().includes(q) ||
          (t.subject ?? "").toLowerCase().includes(q) ||
          t.campaign_name.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allTemplates, typeFilter, campaignFilter, searchQuery]);

  // ===== Counts for filter tabs =====
  const counts = useMemo(() => {
    let filtered = allTemplates;
    if (campaignFilter) {
      filtered = filtered.filter((t) => t.campaign_id === campaignFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          (t.name ?? "").toLowerCase().includes(q) ||
          (t.subject ?? "").toLowerCase().includes(q) ||
          t.campaign_name.toLowerCase().includes(q)
      );
    }
    return {
      all: filtered.length,
      dm: filtered.filter((t) => (t.type || "email") === "dm").length,
      email: filtered.filter((t) => (t.type || "email") === "email").length,
    };
  }, [allTemplates, campaignFilter, searchQuery]);

  // ===== Fetch proposals when entering editor with a campaign =====
  useEffect(() => {
    async function fetchProposals() {
      if (!editorCampaignId) {
        setProposals([]);
        return;
      }
      const { data } = await supabase
        .from("proposals")
        .select("*")
        .eq("campaign_id", editorCampaignId)
        .order("created_at", { ascending: false });
      if (data) setProposals(data as Proposal[]);
    }
    fetchProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorCampaignId]);

  // ===== Create dialog: proceed to editor =====
  function handleCreateProceed() {
    if (!createCampaignId) {
      toast.error("캠페인을 선택하세요.");
      return;
    }
    const campaign = campaigns.find((c) => c.id === createCampaignId);

    // Count existing templates for this campaign to auto-set round number
    const existingCount = allTemplates.filter(
      (t) =>
        t.campaign_id === createCampaignId &&
        (t.type || "email") === createType
    ).length;

    setEditorCampaignId(createCampaignId);
    setEditorCampaignName(campaign?.name ?? "");
    setForm({
      ...INITIAL_FORM,
      type: createType,
      roundNumber: existingCount + 1,
    });
    setEditing(null);
    setShowCreateDialog(false);
    setShowEditor(true);
  }

  // ===== Open editor for editing an existing template =====
  function startEdit(tmpl: TemplateWithCampaign) {
    const templateType: TemplateType =
      (tmpl.type as TemplateType) || "email";

    setEditorCampaignId(tmpl.campaign_id);
    setEditorCampaignName(tmpl.campaign_name);
    setForm({
      name: tmpl.name ?? "",
      type: templateType,
      roundNumber: tmpl.round_number,
      dmBody: tmpl.dm_body ?? "",
      subject: tmpl.subject ?? "",
      bodyHtml: tmpl.body_html ?? "",
      senderName: tmpl.sender_name ?? "",
      senderEmail: tmpl.sender_email ?? "",
      proposalId: tmpl.proposal_id ?? null,
    });
    setEditing(tmpl.id);
    setShowEditor(true);
  }

  // ===== Duplicate template =====
  async function handleDuplicate(tmpl: TemplateWithCampaign) {
    const payload = {
      campaign_id: tmpl.campaign_id,
      name: `${tmpl.name ?? "템플릿"} (복사본)`,
      type: tmpl.type,
      round_number: tmpl.round_number,
      subject: tmpl.subject,
      body_html: tmpl.body_html,
      sender_name: tmpl.sender_name,
      sender_email: tmpl.sender_email,
      dm_body: tmpl.dm_body,
      proposal_id: tmpl.proposal_id,
    };
    const { error } = await supabase.from("email_templates").insert(payload);
    if (error) {
      toast.error("복제 실패: " + error.message);
    } else {
      toast.success("템플릿이 복제되었습니다.");
      fetchAllTemplates();
    }
  }

  // ===== Close editor =====
  function closeEditor() {
    setShowEditor(false);
    setEditing(null);
    setEditorCampaignId(null);
    setEditorCampaignName("");
    setForm(INITIAL_FORM);
    setProposals([]);
  }

  // ===== Save template =====
  async function handleSave() {
    if (!editorCampaignId) {
      toast.error("캠페인을 선택하세요.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("템플릿 이름을 입력하세요.");
      return;
    }
    if (form.type === "dm" && !form.dmBody.trim()) {
      toast.error("DM 메시지를 입력하세요.");
      return;
    }
    if (form.type === "email" && !form.subject.trim()) {
      toast.error("이메일 제목을 입력하세요.");
      return;
    }

    setSaving(true);

    const payload = {
      campaign_id: editorCampaignId,
      name: form.name,
      type: form.type,
      round_number: form.roundNumber,
      subject: form.type === "email" ? form.subject : "",
      body_html: form.type === "email" ? form.bodyHtml : "",
      sender_name: form.type === "email" ? form.senderName || null : null,
      sender_email: form.type === "email" ? form.senderEmail || null : null,
      dm_body: form.type === "dm" ? form.dmBody : null,
      proposal_id: form.proposalId || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("email_templates")
        .update(payload)
        .eq("id", editing);

      if (error) {
        toast.error("수정 실패: " + error.message);
      } else {
        toast.success("템플릿이 수정되었습니다.");
        closeEditor();
        fetchAllTemplates();
      }
    } else {
      const { error } = await supabase
        .from("email_templates")
        .insert(payload);

      if (error) {
        toast.error("생성 실패: " + error.message);
      } else {
        toast.success("템플릿이 생성되었습니다.");
        closeEditor();
        fetchAllTemplates();
      }
    }

    setSaving(false);
  }

  // ===== Delete template =====
  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error("삭제 실패");
    } else {
      setAllTemplates((prev) =>
        prev.filter((t) => t.id !== deleteTarget.id)
      );
      toast.success("템플릿이 삭제되었습니다.");
    }
    setDeleteTarget(null);
  }

  // ===== Helper: strip HTML for preview text =====
  function getPreviewText(tmpl: EmailTemplate): string {
    const tmplType = (tmpl.type || "email") as TemplateType;
    if (tmplType === "dm") {
      return (tmpl.dm_body ?? "").replace(/\{\{[^}]+\}\}/g, "...").trim();
    }
    return (tmpl.body_html ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/\{\{[^}]+\}\}/g, "...")
      .trim();
  }

  // ===== Helper: format date =====
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "오늘";
    if (diffDays === 1) return "어제";
    if (diffDays < 7) return `${diffDays}일 전`;

    return d.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  }

  // ===============================================
  // RENDER: Editor View
  // ===============================================
  if (showEditor) {
    return (
      <div className="space-y-6">
        {/* Editor Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={closeEditor}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            돌아가기
          </Button>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={
                form.type === "dm"
                  ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                  : "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
              }
            >
              {form.type === "dm" ? (
                <MessageSquare className="w-3 h-3 mr-1" />
              ) : (
                <Mail className="w-3 h-3 mr-1" />
              )}
              {form.type === "dm" ? "DM" : "이메일"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {editorCampaignName}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={closeEditor}>
              취소
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {editing ? "수정 저장" : "생성"}
            </Button>
          </div>
        </div>

        {/* Editor Body */}
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Common fields row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>템플릿 이름</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder={
                    form.type === "dm"
                      ? "예: 1차 DM 제안 메시지"
                      : "예: 1차 이메일 제안"
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>타입</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as TemplateType }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dm">DM</SelectItem>
                    <SelectItem value="email">이메일</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>회차</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.roundNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      roundNumber: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="mt-1"
                />
              </div>
            </div>

            {/* Proposal selector */}
            {proposals.length > 0 && (
              <div>
                <Label>연결 제안서 (선택)</Label>
                <Select
                  value={form.proposalId ?? "__none__"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      proposalId: v === "__none__" ? null : v,
                    }))
                  }
                >
                  <SelectTrigger className="mt-1 w-80">
                    <SelectValue placeholder="제안서를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">연결 안 함</SelectItem>
                    {proposals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Email-specific sender fields */}
            {form.type === "email" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>보내는 이름</Label>
                  <Input
                    value={form.senderName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        senderName: e.target.value,
                      }))
                    }
                    placeholder="Uncustom"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>보내는 이메일</Label>
                  <Input
                    value={form.senderEmail}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        senderEmail: e.target.value,
                      }))
                    }
                    placeholder="hello@uncustom.com"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Type-specific editor */}
            {form.type === "dm" ? (
              <DmEditor
                value={form.dmBody}
                onChange={(val) =>
                  setForm((f) => ({ ...f, dmBody: val }))
                }
                campaignName={editorCampaignName}
              />
            ) : (
              <EmailEditor
                subject={form.subject}
                onSubjectChange={(s) =>
                  setForm((f) => ({ ...f, subject: s }))
                }
                body={form.bodyHtml}
                onBodyChange={(html) =>
                  setForm((f) => ({ ...f, bodyHtml: html }))
                }
                senderName={form.senderName}
                senderEmail={form.senderEmail}
                campaignName={editorCampaignName}
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===============================================
  // RENDER: Overview / Landing View
  // ===============================================
  return (
    <div className="space-y-6">
      {/* ===== HERO HEADER ===== */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <h1 className="text-3xl font-bold tracking-tight">템플릿</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            DM과 이메일 템플릿을 만들고 관리하세요. 캠페인별로 회차에 맞는
            메시지를 미리 준비해두면 섭외 속도를 높일 수 있습니다.
          </p>

          <div className="flex items-center gap-3 mt-5">
            <Button
              onClick={() => {
                setCreateCampaignId(null);
                setCreateType("dm");
                setShowCreateDialog(true);
              }}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              새 템플릿 만들기
            </Button>
          </div>
        </div>
      </div>

      {/* ===== FILTERS BAR ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Type filter tabs */}
        <Tabs
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
        >
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3 h-7 gap-1.5">
              전체
              <span className="text-muted-foreground/70 tabular-nums">
                {counts.all}
              </span>
            </TabsTrigger>
            <TabsTrigger value="dm" className="text-xs px-3 h-7 gap-1.5">
              <MessageSquare className="w-3 h-3" />
              DM
              <span className="text-muted-foreground/70 tabular-nums">
                {counts.dm}
              </span>
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs px-3 h-7 gap-1.5">
              <Mail className="w-3 h-3" />
              이메일
              <span className="text-muted-foreground/70 tabular-nums">
                {counts.email}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-1 sm:ml-auto">
          {/* Campaign dropdown filter */}
          <Select
            value={campaignFilter ?? "__all__"}
            onValueChange={(v) =>
              setCampaignFilter(v === "__all__" ? null : v)
            }
          >
            <SelectTrigger className="w-52 h-9 text-xs">
              <SelectValue placeholder="전체 캠페인" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">전체 캠페인</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="템플릿 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ===== TEMPLATE GRID ===== */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">로딩 중...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        /* ===== EMPTY STATE ===== */
        <div className="relative overflow-hidden rounded-xl border bg-card">
          <div className="py-24 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
              <LayoutTemplate className="w-10 h-10 text-primary/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {allTemplates.length === 0
                ? "아직 만든 템플릿이 없습니다"
                : "검색 결과가 없습니다"}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
              {allTemplates.length === 0
                ? "DM이나 이메일 템플릿을 만들어 인플루언서 섭외를 더 빠르게 시작하세요. 개인화 태그를 활용하면 맞춤 메시지를 자동으로 만들 수 있습니다."
                : "다른 검색어나 필터를 시도해 보세요."}
            </p>
            {allTemplates.length === 0 && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateCampaignId(null);
                    setCreateType("dm");
                    setShowCreateDialog(true);
                  }}
                  className="gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  DM 템플릿 만들기
                </Button>
                <Button
                  onClick={() => {
                    setCreateCampaignId(null);
                    setCreateType("email");
                    setShowCreateDialog(true);
                  }}
                  className="gap-1.5"
                >
                  <Mail className="w-4 h-4" />
                  이메일 템플릿 만들기
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ===== TEMPLATE CARDS GRID ===== */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTemplates.map((tmpl) => {
            const tmplType = (tmpl.type || "email") as TemplateType;
            const isDm = tmplType === "dm";
            const preview = getPreviewText(tmpl);

            return (
              <div
                key={tmpl.id}
                className="group relative rounded-xl border bg-card hover:shadow-md transition-all duration-200 hover:border-primary/30 cursor-pointer"
                onClick={() => startEdit(tmpl)}
              >
                {/* Type accent stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${
                    isDm
                      ? "bg-blue-500/60 dark:bg-blue-400/40"
                      : "bg-purple-500/60 dark:bg-purple-400/40"
                  }`}
                />

                <div className="p-5 pt-4">
                  {/* Top row: badges + actions */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Type badge */}
                      <Badge
                        variant="secondary"
                        className={
                          isDm
                            ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50"
                            : "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800/50"
                        }
                      >
                        {isDm ? (
                          <MessageSquare className="w-3 h-3 mr-1" />
                        ) : (
                          <Mail className="w-3 h-3 mr-1" />
                        )}
                        {isDm ? "DM" : "이메일"}
                      </Badge>

                      {/* Round badge */}
                      <Badge variant="outline" className="text-xs font-normal">
                        {tmpl.round_number}회차
                      </Badge>
                    </div>

                    {/* Action buttons (visible on hover) */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(tmpl);
                        }}
                        title="복제"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(tmpl);
                        }}
                        title="편집"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(tmpl);
                        }}
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Template name */}
                  <h3 className="font-semibold text-sm mb-1.5 truncate">
                    {tmpl.name || "(이름 없음)"}
                  </h3>

                  {/* Subject line for email */}
                  {!isDm && tmpl.subject && (
                    <p className="text-xs text-muted-foreground mb-1.5 truncate">
                      제목: {tmpl.subject}
                    </p>
                  )}

                  {/* Preview text */}
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 min-h-[2.5rem] leading-relaxed">
                    {preview || "내용 없음"}
                  </p>

                  {/* Footer: campaign name + date */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                    <Badge
                      variant="secondary"
                      className="text-xs font-normal bg-muted/50 max-w-[60%] truncate"
                    >
                      <Sparkles className="w-3 h-3 mr-1 shrink-0" />
                      <span className="truncate">
                        {tmpl.campaign_name}
                      </span>
                    </Badge>
                    <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(tmpl.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== CREATE TEMPLATE DIALOG ===== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>새 템플릿 만들기</DialogTitle>
            <DialogDescription>
              캠페인과 템플릿 타입을 선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Campaign selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">캠페인 선택</Label>
              {campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  캠페인이 없습니다. 먼저 캠페인을 생성하세요.
                </p>
              ) : (
                <Select
                  value={createCampaignId ?? ""}
                  onValueChange={(v) => setCreateCampaignId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="캠페인을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Template type selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">템플릿 타입</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCreateType("dm")}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    createType === "dm"
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-400"
                      : "border-border hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      createType === "dm"
                        ? "bg-blue-100 dark:bg-blue-900/40"
                        : "bg-muted"
                    }`}
                  >
                    <MessageSquare
                      className={`w-5 h-5 ${
                        createType === "dm"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      createType === "dm"
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-foreground"
                    }`}
                  >
                    DM
                  </span>
                  <span className="text-xs text-muted-foreground">
                    인스타그램 DM 메시지
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateType("email")}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    createType === "email"
                      ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/20 dark:border-purple-400"
                      : "border-border hover:border-purple-300 dark:hover:border-purple-700"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      createType === "email"
                        ? "bg-purple-100 dark:bg-purple-900/40"
                        : "bg-muted"
                    }`}
                  >
                    <Mail
                      className={`w-5 h-5 ${
                        createType === "email"
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      createType === "email"
                        ? "text-purple-700 dark:text-purple-300"
                        : "text-foreground"
                    }`}
                  >
                    이메일
                  </span>
                  <span className="text-xs text-muted-foreground">
                    HTML 이메일 템플릿
                  </span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleCreateProceed}
              disabled={!createCampaignId || campaigns.length === 0}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              만들기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿 삭제</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name || deleteTarget?.subject}&quot; 템플릿을
              삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
