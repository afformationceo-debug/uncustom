"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Save,
  Send,
  Loader2,
  ExternalLink,
  Trash2,
  Eye,
  Pencil,
  Copy,
  X,
  ImagePlus,
  FileText,
  MessageSquare,
  Target,
  Gift,
  Package,
  Tag,
  Hash,
  Bell,
  ChevronRight,
  ArrowLeft,
  Search,
  Globe,
  Link as LinkIcon,
  Users,
  Calendar,
  ChevronDown,
  LayoutGrid,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables, Json } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const TiptapEditor = dynamic(
  () => import("@/components/email/template-editor"),
  { ssr: false, loading: () => <div className="border rounded-md min-h-[150px] bg-muted/30 animate-pulse" /> }
);

// ---------- Types ----------

type Proposal = Tables<"proposals"> & {
  response_count?: number;
  campaign_name?: string;
};
type Campaign = Tables<"campaigns">;

interface Product {
  name: string;
  image_url: string;
  description: string;
}

interface ProposalForm {
  title: string;
  language: string;
  hero_image_url: string;
  mission_html: string;
  mission_images: string[];
  products: Product[];
  required_tags: string[];
  rewards_html: string;
  collect_instagram: boolean;
  collect_paypal: boolean;
  collect_basic_info: boolean;
  collect_shipping: boolean;
  cs_channel: string;
  cs_account: string;
  notice_html: string;
}

// ---------- Constants ----------

const defaultForm: ProposalForm = {
  title: "",
  language: "ko",
  hero_image_url: "",
  mission_html: "",
  mission_images: [],
  products: [],
  required_tags: [],
  rewards_html: "",
  collect_instagram: true,
  collect_paypal: false,
  collect_basic_info: true,
  collect_shipping: false,
  cs_channel: "",
  cs_account: "",
  notice_html: "",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  published: "공개",
  closed: "마감",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-500/10 text-green-600 border-green-500/20",
  closed: "bg-red-500/10 text-red-600 border-red-500/20",
};

const LANGUAGE_OPTIONS = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "es", label: "Espanol" },
  { value: "vi", label: "Tieng Viet" },
];

const SECTION_NAV = [
  { id: "mission", label: "미션", icon: Target },
  { id: "mission-images", label: "콘텐츠 레퍼런스", icon: ImagePlus },
  { id: "rewards", label: "리워드", icon: Gift },
  { id: "products", label: "제품 정보", icon: Package },
  { id: "tags", label: "필수 태그", icon: Hash },
  { id: "collect", label: "수집 항목", icon: Tag },
  { id: "cs", label: "CS 채널", icon: MessageSquare },
  { id: "notice", label: "유의사항", icon: Bell },
];

type StatusFilter = "all" | "draft" | "published" | "closed";
type PageView = "list" | "editor" | "responses";

// ---------- Helpers ----------

function renderHtmlContent(html: string): React.ReactElement {
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ProposalsPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">로딩 중...</div>}>
      <ProposalsPage />
    </Suspense>
  );
}

function ProposalsPage() {
  // --- Data ---
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // --- View state ---
  const [view, setView] = useState<PageView>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Campaign selection dialog ---
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // --- Editor state ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorCampaignId, setEditorCampaignId] = useState<string | null>(null);
  const [editorCampaignName, setEditorCampaignName] = useState<string>("");
  const [form, setForm] = useState<ProposalForm>({ ...defaultForm });
  const [tagInput, setTagInput] = useState("");
  const [activeSection, setActiveSection] = useState<string>("mission");
  const formRef = useRef<HTMLDivElement>(null);

  // --- Responses state ---
  const [responsesProposal, setResponsesProposal] = useState<{ id: string; title: string } | null>(null);
  const [responses, setResponses] = useState<Tables<"proposal_responses">[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchCampaigns = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (!member) return;

    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("team_id", member.team_id)
      .order("created_at", { ascending: false });

    if (data) {
      setCampaigns(data as Campaign[]);
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proposals");
      if (res.ok) {
        const data: Proposal[] = await res.json();
        // Enrich with campaign names from our local campaigns state
        setProposals(data);
      }
    } catch {
      toast.error("제안서 목록을 불러오는데 실패했습니다.");
    }
    setLoading(false);
  }, []);

  // Enrich proposals with campaign names when campaigns load
  const enrichedProposals = useMemo(() => {
    const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));
    return proposals.map((p) => ({
      ...p,
      campaign_name: p.campaign_id ? campaignMap.get(p.campaign_id) || "캠페인" : "미지정",
    }));
  }, [proposals, campaigns]);

  useEffect(() => {
    fetchCampaigns();
    fetchProposals();
  }, [fetchCampaigns, fetchProposals]);

  // --- Filtered proposals ---
  const filteredProposals = useMemo(() => {
    let result = enrichedProposals;

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (campaignFilter !== "all") {
      result = result.filter((p) => p.campaign_id === campaignFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.campaign_name && p.campaign_name.toLowerCase().includes(q))
      );
    }

    return result;
  }, [enrichedProposals, statusFilter, campaignFilter, searchQuery]);

  // --- Stats ---
  const stats = useMemo(() => {
    const all = enrichedProposals.length;
    const draft = enrichedProposals.filter((p) => p.status === "draft").length;
    const published = enrichedProposals.filter((p) => p.status === "published").length;
    const closed = enrichedProposals.filter((p) => p.status === "closed").length;
    const totalResponses = enrichedProposals.reduce((sum, p) => sum + (p.response_count ?? 0), 0);
    return { all, draft, published, closed, totalResponses };
  }, [enrichedProposals]);

  // ============================================================
  // EDITOR ACTIONS
  // ============================================================

  function handleCreateNew() {
    setCampaignsLoading(true);
    setShowCampaignDialog(true);
    // Campaigns are already loaded
    setCampaignsLoading(false);
  }

  function selectCampaignForNewProposal(campaign: Campaign) {
    setShowCampaignDialog(false);
    setEditingId(null);
    setEditorCampaignId(campaign.id);
    setEditorCampaignName(campaign.name);
    setForm({ ...defaultForm });
    setTagInput("");
    setView("editor");
  }

  function openEditEditor(proposal: Proposal) {
    setEditingId(proposal.id);
    setEditorCampaignId(proposal.campaign_id);
    setEditorCampaignName(proposal.campaign_name || "캠페인");

    const products = Array.isArray(proposal.products)
      ? (proposal.products as unknown as Product[])
      : [];
    setForm({
      title: proposal.title,
      language: proposal.language,
      hero_image_url: proposal.hero_image_url || "",
      mission_html: proposal.mission_html || "",
      mission_images: proposal.mission_images || [],
      products,
      required_tags: proposal.required_tags || [],
      rewards_html: proposal.rewards_html || "",
      collect_instagram: proposal.collect_instagram,
      collect_paypal: proposal.collect_paypal,
      collect_basic_info: proposal.collect_basic_info,
      collect_shipping: proposal.collect_shipping,
      cs_channel: proposal.cs_channel || "",
      cs_account: proposal.cs_account || "",
      notice_html: proposal.notice_html || "",
    });
    setTagInput("");
    setView("editor");
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    if (!editorCampaignId) {
      toast.error("캠페인을 선택해주세요.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        campaign_id: editorCampaignId,
        title: form.title,
        language: form.language,
        hero_image_url: form.hero_image_url || null,
        mission_html: form.mission_html || null,
        mission_images: form.mission_images.length > 0 ? form.mission_images : null,
        products: form.products as unknown as Json,
        required_tags: form.required_tags.length > 0 ? form.required_tags : null,
        rewards_html: form.rewards_html || null,
        collect_instagram: form.collect_instagram,
        collect_paypal: form.collect_paypal,
        collect_basic_info: form.collect_basic_info,
        collect_shipping: form.collect_shipping,
        cs_channel: form.cs_channel || null,
        cs_account: form.cs_account || null,
        notice_html: form.notice_html || null,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/proposals/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const data = await res.json();
        toast.success(editingId ? "제안서가 저장되었습니다." : "제안서가 생성되었습니다.");
        if (!editingId) {
          setEditingId(data.id);
        }
        fetchProposals();
      } else {
        const err = await res.json();
        toast.error(err.error || "저장에 실패했습니다.");
      }
    } catch {
      toast.error("저장 중 오류가 발생했습니다.");
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!editingId) {
      toast.error("먼저 제안서를 저장해주세요.");
      return;
    }

    setPublishing(true);
    try {
      await handleSave();

      const res = await fetch(`/api/proposals/${editingId}`, {
        method: "PATCH",
      });

      if (res.ok) {
        toast.success("제안서가 게시되었습니다.");
        fetchProposals();
      } else {
        const err = await res.json();
        toast.error(err.error || "게시에 실패했습니다.");
      }
    } catch {
      toast.error("게시 중 오류가 발생했습니다.");
    }
    setPublishing(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 제안서를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/proposals/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("제안서가 삭제되었습니다.");
        fetchProposals();
        if (editingId === id) {
          setEditingId(null);
          setForm({ ...defaultForm });
          setView("list");
        }
      } else {
        toast.error("삭제에 실패했습니다.");
      }
    } catch {
      toast.error("삭제 중 오류가 발생했습니다.");
    }
  }

  // ============================================================
  // RESPONSES
  // ============================================================

  async function fetchResponses(proposalId: string, title: string) {
    setResponsesProposal({ id: proposalId, title });
    setResponsesLoading(true);
    try {
      const res = await fetch(`/api/proposals/${proposalId}/responses`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data);
      }
    } catch {
      toast.error("응답 목록을 불러오는데 실패했습니다.");
    }
    setResponsesLoading(false);
  }

  function openResponses(proposalId: string, title: string) {
    fetchResponses(proposalId, title);
    setView("responses");
  }

  // ============================================================
  // FORM HELPERS
  // ============================================================

  function copyPublicUrl(slug: string) {
    const url = `${window.location.origin}/proposals/p/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("공개 URL이 클립보드에 복사되었습니다.");
  }

  function addProduct() {
    setForm((prev) => ({
      ...prev,
      products: [...prev.products, { name: "", image_url: "", description: "" }],
    }));
  }

  function updateProduct(index: number, field: keyof Product, value: string) {
    setForm((prev) => {
      const products = [...prev.products];
      products[index] = { ...products[index], [field]: value };
      return { ...prev, products };
    });
  }

  function removeProduct(index: number) {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index),
    }));
  }

  function addMissionImage() {
    setForm((prev) => ({
      ...prev,
      mission_images: [...prev.mission_images, ""],
    }));
  }

  function updateMissionImage(index: number, value: string) {
    setForm((prev) => {
      const images = [...prev.mission_images];
      images[index] = value;
      return { ...prev, mission_images: images };
    });
  }

  function removeMissionImage(index: number) {
    setForm((prev) => ({
      ...prev,
      mission_images: prev.mission_images.filter((_, i) => i !== index),
    }));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    const normalized = tag.startsWith("#") ? tag : `#${tag}`;
    if (form.required_tags.includes(normalized)) {
      toast.error("이미 추가된 태그입니다.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      required_tags: [...prev.required_tags, normalized],
    }));
    setTagInput("");
  }

  function removeTag(index: number) {
    setForm((prev) => ({
      ...prev,
      required_tags: prev.required_tags.filter((_, i) => i !== index),
    }));
  }

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId);
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Observe sections for active state
  useEffect(() => {
    if (view !== "editor") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "");
            setActiveSection(id);
          }
        }
      },
      { threshold: 0.3, rootMargin: "-100px 0px -50% 0px" }
    );

    const timer = setTimeout(() => {
      SECTION_NAV.forEach(({ id }) => {
        const el = document.getElementById(`section-${id}`);
        if (el) observer.observe(el);
      });
    }, 300);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [view]);

  // ============================================================
  // RENDER: CAMPAIGN SELECTION DIALOG
  // ============================================================

  function renderCampaignDialog() {
    return (
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5 text-primary" />
              캠페인 선택
            </DialogTitle>
            <DialogDescription>
              제안서를 생성할 캠페인을 선택해주세요.
            </DialogDescription>
          </DialogHeader>

          {campaignsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <LayoutGrid className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">캠페인이 없습니다</p>
              <p className="text-xs text-muted-foreground mt-1">
                먼저 캠페인을 생성해주세요.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto py-2">
              {campaigns.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => selectCampaignForNewProposal(campaign)}
                  className="group text-left p-4 rounded-xl border border-border/50 bg-card hover:bg-primary/5 hover:border-primary/30 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {campaign.name}
                      </h3>
                      {campaign.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {campaign.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            campaign.status === "active"
                              ? "border-green-500/30 text-green-600"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {campaign.status === "active" ? "진행중" : campaign.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(campaign.created_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // ============================================================
  // RENDER: LIST VIEW (Landing)
  // ============================================================

  function renderListView() {
    const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
      { key: "all", label: "전체", count: stats.all },
      { key: "draft", label: "초안", count: stats.draft },
      { key: "published", label: "공개", count: stats.published },
      { key: "closed", label: "마감", count: stats.closed },
    ];

    return (
      <div className="space-y-6">
        {/* ===== HERO SECTION ===== */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

          <div className="relative px-8 py-10">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    제안서 관리
                  </h1>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                  인플루언서에게 보낼 제안서를 작성하고 관리하세요.{" "}
                  <span className="text-foreground/70">
                    공개 링크를 통해 간편하게 응답을 수집할 수 있습니다.
                  </span>
                </p>
              </div>

              <Button
                onClick={handleCreateNew}
                size="default"
                className="gap-1.5 shadow-sm flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                제안서 만들기
              </Button>
            </div>

            {/* Stats Row */}
            {stats.all > 0 && (
              <div className="flex items-center gap-6 mt-6 pt-5 border-t border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-foreground/40" />
                  <span className="text-xs text-muted-foreground">
                    전체 <span className="font-semibold text-foreground">{stats.all}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs text-muted-foreground">
                    공개 <span className="font-semibold text-green-600">{stats.published}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">
                    초안 <span className="font-semibold text-foreground">{stats.draft}</span>
                  </span>
                </div>
                {stats.closed > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs text-muted-foreground">
                      마감 <span className="font-semibold text-red-600">{stats.closed}</span>
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    총 응답 <span className="font-semibold text-foreground">{stats.totalResponses}</span>건
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== FILTERS ===== */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status tabs */}
          <div className="flex items-center bg-muted/50 rounded-lg p-1 gap-0.5">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`
                  px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                  ${statusFilter === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                {tab.label}
                <span className={`ml-1.5 ${statusFilter === tab.key ? "text-foreground/70" : "text-muted-foreground/60"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Campaign filter */}
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="캠페인 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 캠페인</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제안서 검색..."
              className="pl-8 h-8 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ===== PUBLISHED LINKS OVERVIEW ===== */}
        {(() => {
          const publishedLinks = enrichedProposals.filter((p) => p.status === "published");
          if (publishedLinks.length === 0) return null;
          return (
            <Card className="border-border/50 bg-gradient-to-r from-green-500/5 via-background to-green-500/3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                      <LinkIcon className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    공개 링크 관리
                    <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600">
                      {publishedLinks.length}개 활성
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      const urls = publishedLinks.map((p) => `${window.location.origin}/proposals/p/${p.slug}`).join("\n");
                      navigator.clipboard.writeText(urls);
                      toast.success("모든 공개 링크가 복사되었습니다.");
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    전체 복사
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {publishedLinks.map((p) => {
                    const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/proposals/p/${p.slug}`;
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/80 border border-border/30 hover:border-green-500/30 transition-colors group/link">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Globe className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate">{p.title}</span>
                          <Badge variant="outline" className="text-[9px] flex-shrink-0">{p.campaign_name}</Badge>
                        </div>
                        <code className="text-[10px] text-muted-foreground truncate max-w-[300px] hidden sm:block font-mono">
                          /proposals/p/{p.slug}
                        </code>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground mr-1">
                            {p.response_count ?? 0}건
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-green-600"
                            onClick={() => {
                              navigator.clipboard.writeText(publicUrl);
                              toast.success("링크가 복사되었습니다.");
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <a href={`/proposals/p/${p.slug}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-green-600">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ===== PROPOSAL CARDS GRID ===== */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProposals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-20 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                    <FileText className="w-8 h-8 text-primary/60" />
                  </div>
                </div>
                {enrichedProposals.length === 0 ? (
                  <>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        첫 제안서를 만들어보세요
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
                        인플루언서에게 보낼 캠페인 제안서를 작성하고, 공개 링크를 통해 응답을 수집하세요.
                        제안서 하나로 수백 명의 인플루언서에게 동시에 제안할 수 있습니다.
                      </p>
                    </div>
                    <Button onClick={handleCreateNew} className="gap-1.5 mt-2">
                      <Plus className="w-4 h-4" />
                      제안서 만들기
                    </Button>
                  </>
                ) : (
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      검색 결과가 없습니다
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      필터를 변경하거나 검색어를 수정해보세요.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onEdit={() => openEditEditor(proposal)}
                onDelete={() => handleDelete(proposal.id)}
                onCopyUrl={() => copyPublicUrl(proposal.slug)}
                onViewResponses={() => openResponses(proposal.id, proposal.title)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER: EDITOR VIEW
  // ============================================================

  function renderEditorView() {
    return (
      <div className="space-y-5">
        {/* Editor top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView("list")}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              목록
            </Button>
            <div className="w-px h-5 bg-border" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editingId ? "제안서 수정" : "새 제안서 작성"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px]">
                  {editorCampaignName}
                </Badge>
                {editingId && (
                  <Badge variant="secondary" className="text-[10px]">
                    수정 중
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm" variant="outline" className="gap-1.5">
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              저장
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishing || !editingId}
              size="sm"
              className="gap-1.5"
            >
              {publishing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              게시
            </Button>
          </div>
        </div>

        {/* Split view: Form + Preview + Section Nav */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_auto] gap-6">
          {/* LEFT: Form */}
          <div ref={formRef} className="space-y-1 max-h-[calc(100vh-240px)] overflow-y-auto pr-2 scroll-smooth">
            {/* Title & Language Card */}
            <Card className="border-border/50">
              <CardContent className="pt-5 space-y-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">제목 *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="캠페인 제안서 제목을 입력하세요"
                    className="mt-1.5 h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">언어</Label>
                    <Select
                      value={form.language}
                      onValueChange={(v) => setForm((p) => ({ ...p, language: v }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">히어로 이미지</Label>
                    <Input
                      value={form.hero_image_url}
                      onChange={(e) => setForm((p) => ({ ...p, hero_image_url: e.target.value }))}
                      placeholder="https://example.com/hero.jpg"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mission Section */}
            <div id="section-mission" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <Target className="w-3.5 h-3.5 text-primary" />
                    </div>
                    미션
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <TiptapEditor
                    content={form.mission_html}
                    onChange={(html) => setForm((p) => ({ ...p, mission_html: html }))}
                    placeholder="인플루언서에게 요청할 미션 내용을 작성하세요..."
                  />
                </CardContent>
              </Card>
            </div>

            {/* Mission Images Section */}
            <div id="section-mission-images" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                        <ImagePlus className="w-3.5 h-3.5 text-primary" />
                      </div>
                      콘텐츠 레퍼런스
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={addMissionImage} className="h-7 text-xs gap-1">
                      <Plus className="w-3 h-3" />
                      이미지 추가
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {form.mission_images.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <ImagePlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">레퍼런스 이미지를 추가하세요</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.mission_images.map((url, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={url}
                            onChange={(e) => updateMissionImage(i, e.target.value)}
                            placeholder="이미지 URL"
                            className="flex-1 text-sm"
                          />
                          <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeMissionImage(i)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Rewards Section */}
            <div id="section-rewards" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <Gift className="w-3.5 h-3.5 text-primary" />
                    </div>
                    리워드
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <TiptapEditor
                    content={form.rewards_html}
                    onChange={(html) => setForm((p) => ({ ...p, rewards_html: html }))}
                    placeholder="인플루언서에게 제공할 리워드를 작성하세요..."
                  />
                </CardContent>
              </Card>
            </div>

            {/* Products Section */}
            <div id="section-products" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                        <Package className="w-3.5 h-3.5 text-primary" />
                      </div>
                      제품 정보
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={addProduct} className="h-7 text-xs gap-1">
                      <Plus className="w-3 h-3" />
                      제품 추가
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {form.products.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Package className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">제품을 추가하세요</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.products.map((product, i) => (
                        <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">제품 {i + 1}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeProduct(i)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Input
                            value={product.name}
                            onChange={(e) => updateProduct(i, "name", e.target.value)}
                            placeholder="제품명"
                            className="text-sm"
                          />
                          <Input
                            value={product.image_url}
                            onChange={(e) => updateProduct(i, "image_url", e.target.value)}
                            placeholder="제품 이미지 URL"
                            className="text-sm"
                          />
                          <Textarea
                            value={product.description}
                            onChange={(e) => updateProduct(i, "description", e.target.value)}
                            placeholder="제품 설명"
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tags Section */}
            <div id="section-tags" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <Hash className="w-3.5 h-3.5 text-primary" />
                    </div>
                    필수 태그
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="#hashtag"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      className="flex-1 text-sm"
                    />
                    <Button variant="outline" size="sm" onClick={addTag} className="h-9">
                      추가
                    </Button>
                  </div>
                  {form.required_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.required_tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                          {tag}
                          <button onClick={() => removeTag(i)} className="hover:text-destructive ml-0.5">
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Collect Toggles Section */}
            <div id="section-collect" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                    </div>
                    수집 항목
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={form.collect_basic_info}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, collect_basic_info: !!v }))}
                      />
                      <span className="text-sm">기본 정보</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={form.collect_instagram}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, collect_instagram: !!v }))}
                      />
                      <span className="text-sm">Instagram ID</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={form.collect_paypal}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, collect_paypal: !!v }))}
                      />
                      <span className="text-sm">PayPal 이메일</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                      <Checkbox
                        checked={form.collect_shipping}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, collect_shipping: !!v }))}
                      />
                      <span className="text-sm">배송지 주소</span>
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* CS Channel Section */}
            <div id="section-cs" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    </div>
                    CS 채널
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      value={form.cs_channel || "none"}
                      onValueChange={(v) => setForm((p) => ({ ...p, cs_channel: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="채널 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">선택 안 함</SelectItem>
                        <SelectItem value="kakao">카카오톡</SelectItem>
                        <SelectItem value="instagram">Instagram DM</SelectItem>
                        <SelectItem value="email">이메일</SelectItem>
                        <SelectItem value="line">LINE</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                    <div>
                      <Input
                        value={form.cs_account}
                        onChange={(e) => setForm((p) => ({ ...p, cs_account: e.target.value }))}
                        placeholder="계정/연락처 (링크 형태로 입력)"
                      />
                    </div>
                  </div>
                  {/* URL link preview for cs_account */}
                  {form.cs_account && isUrl(form.cs_account) && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                      <LinkIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <a
                        href={form.cs_account}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {form.cs_account}
                      </a>
                      <ExternalLink className="w-3 h-3 text-primary/60 flex-shrink-0" />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    URL로 입력하면 제안서에서 클릭 가능한 링크로 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Notice Section */}
            <div id="section-notice" className="scroll-mt-4">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                      <Bell className="w-3.5 h-3.5 text-primary" />
                    </div>
                    유의사항
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <TiptapEditor
                    content={form.notice_html}
                    onChange={(html) => setForm((p) => ({ ...p, notice_html: html }))}
                    placeholder="유의사항이나 공지사항을 입력하세요..."
                  />
                </CardContent>
              </Card>
            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
          </div>

          {/* CENTER: Preview — matches public page layout */}
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            <div className="space-y-3">
              {/* Preview header bar */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">실제 페이지 미리보기</span>
                </div>
                {editingId && (
                  <a
                    href={`/proposals/p/${enrichedProposals.find((p) => p.id === editingId)?.slug ?? ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-green-600 hover:text-green-700">
                      <ExternalLink className="w-3 h-3" />
                      새 탭에서 보기
                    </Button>
                  </a>
                )}
              </div>

              {/* Preview container — simulates public page */}
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-sm">
                {/* Preview: Hero */}
                {form.hero_image_url ? (
                  <div className="relative w-full aspect-[16/9] overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.hero_image_url} alt="Hero" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
                      <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight tracking-tight drop-shadow-lg">
                        {form.title || "제안서 제목"}
                      </h1>
                    </div>
                  </div>
                ) : (
                  <div className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 px-5 pt-8 pb-6">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight tracking-tight">
                      {form.title || "제안서 제목"}
                    </h1>
                  </div>
                )}

                {/* Preview: Content sections */}
                <div className="px-5 divide-y divide-border/40">
                  {/* Mission — admin-authored Tiptap content rendered via renderHtmlContent */}
                  {form.mission_html && (
                    <section className="py-6">
                      <PreviewSectionHeader icon="mission" title="미션" />
                      {renderHtmlContent(form.mission_html)}
                      {form.mission_images.filter(Boolean).length > 0 && (
                        <div className={`mt-4 grid gap-2 ${form.mission_images.filter(Boolean).length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {form.mission_images.filter(Boolean).map((url, i) => (
                            <div key={i} className="rounded-xl overflow-hidden bg-muted border border-border/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Reference ${i + 1}`} className="w-full h-auto object-cover aspect-square"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {/* Products */}
                  {form.products.length > 0 && (
                    <section className="py-6">
                      <PreviewSectionHeader icon="product" title="제품 소개" />
                      <div className="space-y-3">
                        {form.products.map((product, i) => (
                          <div key={i} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex">
                            {product.image_url && (
                              <div className="w-24 h-24 flex-shrink-0 bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              </div>
                            )}
                            <div className="p-3 flex-1 flex flex-col justify-center">
                              <h3 className="font-semibold text-foreground text-sm leading-snug">{product.name || "제품명"}</h3>
                              {product.description && (
                                <p className="text-muted-foreground mt-1 text-xs leading-relaxed line-clamp-2">{product.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Rewards — admin-authored Tiptap content */}
                  {form.rewards_html && (
                    <section className="py-6">
                      <PreviewSectionHeader icon="reward" title="리워드" />
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        {renderHtmlContent(form.rewards_html)}
                      </div>
                    </section>
                  )}

                  {/* Required Tags */}
                  {form.required_tags.length > 0 && (
                    <section className="py-6">
                      <PreviewSectionHeader icon="tag" title="필수 태그" />
                      <div className="flex flex-wrap gap-2">
                        {form.required_tags.map((tag, i) => (
                          <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Notice — admin-authored Tiptap content */}
                  {form.notice_html && (
                    <section className="py-6">
                      <PreviewSectionHeader icon="notice" title="유의사항" />
                      <div className="rounded-xl bg-muted/60 border border-border p-4">
                        {renderHtmlContent(form.notice_html)}
                      </div>
                    </section>
                  )}

                  {/* CS Channel CTA */}
                  {form.cs_channel && form.cs_account && (
                    <section className="py-6">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-3">궁금한 점이 있으신가요?</p>
                        {isUrl(form.cs_account) ? (
                          <a href={form.cs_account} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-sm shadow-lg shadow-primary/25 hover:shadow-xl transition-all">
                            <MessageSquare className="w-4 h-4" />
                            문의하기
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        ) : (
                          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-card border border-border shadow-sm">
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                            <div className="text-left">
                              <p className="text-[10px] text-muted-foreground">{form.cs_channel}</p>
                              <p className="font-semibold text-foreground text-sm">{form.cs_account}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Application form placeholder */}
                  <section className="py-6">
                    <PreviewSectionHeader icon="apply" title="캠페인 신청" />
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
                      {form.collect_basic_info && (
                        <div className="space-y-1"><div className="h-4 w-16 bg-muted rounded" /><div className="h-9 bg-muted/50 rounded-lg border border-border/50" /></div>
                      )}
                      {form.collect_instagram && (
                        <div className="space-y-1"><div className="h-4 w-24 bg-muted rounded" /><div className="h-9 bg-muted/50 rounded-lg border border-border/50" /></div>
                      )}
                      {form.collect_paypal && (
                        <div className="space-y-1"><div className="h-4 w-20 bg-muted rounded" /><div className="h-9 bg-muted/50 rounded-lg border border-border/50" /></div>
                      )}
                      {form.collect_shipping && (
                        <div className="space-y-1"><div className="h-4 w-16 bg-muted rounded" /><div className="h-20 bg-muted/50 rounded-lg border border-border/50" /></div>
                      )}
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {form.collect_basic_info && <Badge variant="outline" className="text-[10px]">이름/이메일/전화</Badge>}
                        {form.collect_instagram && <Badge variant="outline" className="text-[10px]">Instagram ID</Badge>}
                        {form.collect_paypal && <Badge variant="outline" className="text-[10px]">PayPal</Badge>}
                        {form.collect_shipping && <Badge variant="outline" className="text-[10px]">배송지</Badge>}
                      </div>
                      <div className="h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">신청하기</span>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Preview: Footer */}
                <div className="text-center py-6 border-t border-border mx-5">
                  <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider uppercase">Powered by Uncustom</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Floating Section Navigation Badges */}
          <div className="hidden xl:block">
            <div className="sticky top-0 space-y-2">
              {SECTION_NAV.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      group flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl transition-all duration-200
                      ${isActive
                        ? "bg-primary/10 border border-primary/30 shadow-sm"
                        : "hover:bg-muted/50 border border-transparent"
                      }
                    `}
                  >
                    <div
                      className={`
                        flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 flex-shrink-0
                        ${isActive
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                        }
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className={`
                        text-xs font-medium whitespace-nowrap transition-colors duration-200
                        ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}
                      `}
                    >
                      {section.label}
                    </span>
                    {isActive && (
                      <ChevronRight className="w-3 h-3 text-primary ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: RESPONSES VIEW
  // ============================================================

  function renderResponsesView() {
    return (
      <div className="space-y-5">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView("list")}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            목록
          </Button>
          <div className="w-px h-5 bg-border" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">응답 관리</h2>
            {responsesProposal && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {responsesProposal.title}
              </p>
            )}
          </div>
          {responsesProposal && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {responses.length}건의 응답
            </Badge>
          )}
        </div>

        {/* Proposal selector */}
        <Card className="border-border/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium whitespace-nowrap">제안서 선택</Label>
              <Select
                value={responsesProposal?.id || "none"}
                onValueChange={(v) => {
                  if (v === "none") {
                    setResponsesProposal(null);
                    setResponses([]);
                  } else {
                    const p = enrichedProposals.find((p) => p.id === v);
                    if (p) fetchResponses(p.id, p.title);
                  }
                }}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="제안서를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택하세요</SelectItem>
                  {enrichedProposals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Responses table */}
        {!responsesProposal ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">제안서를 선택해주세요</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    제안서를 선택하면 인플루언서 응답 목록이 표시됩니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardHeader className="border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  응답 목록
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  이 제안서에 제출된 인플루언서 응답입니다.
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {responsesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : responses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">아직 응답이 없습니다.</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">이름</TableHead>
                      <TableHead className="font-semibold">Instagram</TableHead>
                      <TableHead className="font-semibold">이메일</TableHead>
                      <TableHead className="font-semibold">전화번호</TableHead>
                      <TableHead className="font-semibold">메시지</TableHead>
                      <TableHead className="font-semibold">제출일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((resp) => (
                      <TableRow key={resp.id}>
                        <TableCell className="font-medium">{resp.influencer_name || "-"}</TableCell>
                        <TableCell>
                          {resp.instagram_id ? (
                            <span className="text-primary font-medium">@{resp.instagram_id}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{resp.email || "-"}</TableCell>
                        <TableCell>{resp.phone || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {resp.message || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(resp.submitted_at).toLocaleString("ko-KR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {renderCampaignDialog()}

      {view === "list" && renderListView()}
      {view === "editor" && renderEditorView()}
      {view === "responses" && renderResponsesView()}
    </div>
  );
}

// ============================================================
// PROPOSAL CARD COMPONENT
// ============================================================

function ProposalCard({
  proposal,
  onEdit,
  onDelete,
  onCopyUrl,
  onViewResponses,
}: {
  proposal: Proposal;
  onEdit: () => void;
  onDelete: () => void;
  onCopyUrl: () => void;
  onViewResponses: () => void;
}) {
  const isPublished = proposal.status === "published";
  const isClosed = proposal.status === "closed";
  const hasHero = !!proposal.hero_image_url;
  const responseCount = proposal.response_count ?? 0;

  return (
    <Card className="group relative overflow-hidden border-border/50 hover:border-border hover:shadow-md transition-all duration-300">
      {/* Hero image background */}
      {hasHero ? (
        <div className="relative h-36 overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proposal.hero_image_url!}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />

          {/* Status badge on top of image */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="secondary"
              className={`${STATUS_COLORS[proposal.status] ?? ""} text-[10px] font-semibold border backdrop-blur-sm`}
            >
              {STATUS_LABELS[proposal.status] ?? proposal.status}
            </Badge>
          </div>

          {/* Actions on top of image */}
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 backdrop-blur-sm bg-background/80"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 backdrop-blur-sm bg-background/80 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        /* No hero - decorative background */
        <div className="relative h-20 overflow-hidden bg-gradient-to-br from-muted/80 to-muted/30">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_var(--tw-gradient-stops))] from-primary/5 to-transparent" />

          {/* Status badge */}
          <div className="absolute top-3 left-3">
            <Badge
              variant="secondary"
              className={`${STATUS_COLORS[proposal.status] ?? ""} text-[10px] font-semibold border`}
            >
              {STATUS_LABELS[proposal.status] ?? proposal.status}
            </Badge>
          </div>

          {/* Actions */}
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Card body */}
      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3
            className="text-sm font-semibold text-foreground line-clamp-1 cursor-pointer hover:text-primary transition-colors"
            onClick={onEdit}
          >
            {proposal.title}
          </h3>
          {/* Campaign name badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-[10px] bg-muted/50">
              {proposal.campaign_name}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(proposal.created_at)}
            </span>
          </div>
        </div>

        {/* Published URL display */}
        {isPublished && (
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-500/5 border border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCopyUrl(); }}
            title="클릭하여 URL 복사"
          >
            <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />
            <code className="text-[10px] text-green-700 dark:text-green-400 truncate font-mono flex-1">
              /proposals/p/{proposal.slug}
            </code>
            <Copy className="w-3 h-3 text-green-500/60 flex-shrink-0" />
          </div>
        )}

        {/* Bottom row: Responses + URL */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          {/* Response count */}
          <button
            onClick={onViewResponses}
            className={`
              flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors
              ${responseCount > 0
                ? "text-primary bg-primary/5 hover:bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }
            `}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            응답 {responseCount}건
          </button>

          {/* Actions */}
          {isPublished ? (
            <a
              href={`/proposals/p/${proposal.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/10">
                <Eye className="w-3 h-3" />
                미리보기
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
          ) : isClosed ? (
            <span className="text-[10px] text-red-500/70 font-medium">마감됨</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">게시 후 공개</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// PREVIEW SECTION HEADER — matches public page SectionHeader
// ============================================================

const PREVIEW_ICONS: Record<string, React.ReactNode> = {
  mission: <Target className="w-4 h-4" />,
  product: <Package className="w-4 h-4" />,
  reward: <Gift className="w-4 h-4" />,
  tag: <Hash className="w-4 h-4" />,
  notice: <Bell className="w-4 h-4" />,
  apply: <Pencil className="w-4 h-4" />,
};

function PreviewSectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary flex-shrink-0">
        {PREVIEW_ICONS[icon] ?? <Target className="w-4 h-4" />}
      </div>
      <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
    </div>
  );
}
