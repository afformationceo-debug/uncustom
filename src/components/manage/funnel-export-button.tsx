"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FunnelExportButtonProps {
  campaignId: string | null;
}

export function FunnelExportButton({ campaignId }: FunnelExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const exportUrl = campaignId
        ? `/api/manage/export?campaign_id=${campaignId}`
        : `/api/manage/export`;
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `campaign-manage-export.csv`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("내보내기 완료");
    } catch {
      toast.error("내보내기 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
      내보내기
    </Button>
  );
}
