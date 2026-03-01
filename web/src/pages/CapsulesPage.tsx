import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  FileText, Globe, ImageIcon, FileType2, Mic, Loader2, AlertCircle,
  Search, SlidersHorizontal, LayoutGrid, List, Plus, Brain,
  CheckCircle2, Clock3, XCircle, Archive, Zap,
} from "lucide-react";
import { capsuleService, type Capsule } from "@/services/capsule";
import { CreateCapsuleDialog } from "@/components/capsules/CreateCapsuleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Source type config ──────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  NOTE: { icon: FileText, label: "笔记", color: "text-violet-600", bg: "bg-violet-50" },
  WEBSITE: { icon: Globe, label: "网页", color: "text-blue-600", bg: "bg-blue-50" },
  IMAGE: { icon: ImageIcon, label: "图片", color: "text-pink-600", bg: "bg-pink-50" },
  PDF: { icon: FileType2, label: "PDF", color: "text-orange-600", bg: "bg-orange-50" },
  AUDIO: { icon: Mic, label: "音频", color: "text-green-600", bg: "bg-green-50" },
};
const DEFAULT_SOURCE = { icon: FileText, label: "文件", color: "text-gray-600", bg: "bg-gray-50" };

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  COMPLETED: { label: "已完成", icon: CheckCircle2, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  PROCESSING: { label: "处理中", icon: Zap, className: "text-blue-700 bg-blue-50 border-blue-200" },
  PENDING: { label: "待处理", icon: Clock3, className: "text-amber-700 bg-amber-50 border-amber-200" },
  FAILED: { label: "失败", icon: XCircle, className: "text-red-700 bg-red-50 border-red-200" },
  ARCHIVED: { label: "已归档", icon: Archive, className: "text-gray-600 bg-gray-50 border-gray-200" },
};

// ─── CapsuleCard ─────────────────────────────────────────────────────────────
function CapsuleCard({ capsule, view }: { capsule: Capsule; view: "grid" | "list" }) {
  const navigate = useNavigate();
  const srcType = (capsule.sourceTypes?.[0] || capsule.sourceType || "NOTE") as string;
  const src = SOURCE_CONFIG[srcType] || DEFAULT_SOURCE;
  const Icon = src.icon;
  const status = STATUS_CONFIG[capsule.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = status.icon;

  const title =
    capsule.summary ||
    capsule.structuredData?.meta?.title ||
    capsule.rawContent?.split("\n")[0]?.slice(0, 60) ||
    "未命名胶囊";

  const preview = capsule.rawContent
    ? capsule.rawContent.replace(/\[Crawled content.*?\]:/s, "").trim().slice(0, 140)
    : "（无预览）";

  const entities = capsule.capsuleEntities?.slice(0, 3) || [];
  const relTime = formatDistanceToNow(new Date(capsule.createdAt), { addSuffix: true, locale: zhCN });

  if (view === "list") {
    return (
      <div
        onClick={() => navigate(`/capsules/${capsule.id}`)}
        className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
      >
        {/* Icon */}
        <div className={cn("shrink-0 flex items-center justify-center w-10 h-10 rounded-lg", src.bg)}>
          <Icon className={cn("h-5 w-5", src.color)} />
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
            {title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
        </div>
        {/* Meta */}
        <div className="shrink-0 flex items-center gap-3">
          {entities.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              <Brain className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{entities.length}</span>
            </div>
          )}
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 font-medium border", status.className)}>
            <StatusIcon className="h-2.5 w-2.5 mr-1" />
            {status.label}
          </Badge>
          <span className="text-xs text-muted-foreground hidden md:block w-20 text-right">{relTime}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(`/capsules/${capsule.id}`)}
      className="group relative flex flex-col rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-md transition-all cursor-pointer overflow-hidden"
    >
      {/* Colored top bar */}
      <div className={cn("h-1 w-full", src.bg.replace("bg-", "bg-").replace("-50", "-300"))} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", src.bg)}>
            <Icon className={cn("h-4 w-4", src.color)} />
          </div>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 font-medium border shrink-0", status.className)}>
            <StatusIcon className="h-2.5 w-2.5 mr-1" />
            {status.label}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Preview */}
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">
          {preview}
        </p>

        {/* Entity tags */}
        {entities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entities.map((ce) => (
              <span
                key={ce.id}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                <Brain className="h-2.5 w-2.5" />
                {ce.entity?.canonicalName}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground">{src.label}</span>
          <span className="text-[10px] text-muted-foreground">{relTime}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border/40 animate-pulse">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-muted rounded w-48" />
          <div className="h-2.5 bg-muted rounded w-72" />
        </div>
        <div className="h-5 bg-muted rounded w-16" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden animate-pulse">
      <div className="h-1 bg-muted" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between">
          <div className="w-9 h-9 rounded-lg bg-muted" />
          <div className="h-5 w-14 rounded bg-muted" />
        </div>
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-2.5 bg-muted rounded" />
          <div className="h-2.5 bg-muted rounded w-5/6" />
          <div className="h-2.5 bg-muted rounded w-4/6" />
        </div>
        <div className="flex gap-1 pt-1">
          <div className="h-4 w-14 rounded-full bg-muted" />
          <div className="h-4 w-12 rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CapsulesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: capsules, isLoading, error, refetch } = useQuery({
    queryKey: ["capsules"],
    queryFn: () => capsuleService.getAll(1, 100),
  });

  // Client-side filter
  const filtered = useMemo(() => {
    if (!capsules) return [];
    return capsules.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.summary?.toLowerCase().includes(q) ||
        c.rawContent?.toLowerCase().includes(q) ||
        c.structuredData?.meta?.title?.toLowerCase().includes(q);

      const matchStatus = statusFilter === "all" || c.status === statusFilter;

      const types = c.sourceTypes ?? (c.sourceType ? [c.sourceType] : []);
      const matchType = typeFilter === "all" || types.includes(typeFilter);

      return matchSearch && matchStatus && matchType;
    });
  }, [capsules, search, statusFilter, typeFilter]);

  const total = capsules?.length ?? 0;
  const completedCount = capsules?.filter((c) => c.status === "COMPLETED").length ?? 0;
  const processingCount = capsules?.filter((c) => c.status === "PROCESSING" || c.status === "PENDING").length ?? 0;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">胶囊库</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "加载中…" : `共 ${total} 个胶囊 · ${completedCount} 已完成 · ${processingCount} 处理中`}
          </p>
        </div>
        <CreateCapsuleDialog />
      </div>

      {/* ── Search & Filters ───────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索胶囊内容、标题或摘要…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
            <SelectItem value="PROCESSING">处理中</SelectItem>
            <SelectItem value="PENDING">待处理</SelectItem>
            <SelectItem value="FAILED">失败</SelectItem>
            <SelectItem value="ARCHIVED">已归档</SelectItem>
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="NOTE">笔记</SelectItem>
            <SelectItem value="WEBSITE">网页</SelectItem>
            <SelectItem value="IMAGE">图片</SelectItem>
            <SelectItem value="PDF">PDF</SelectItem>
            <SelectItem value="AUDIO">音频</SelectItem>
          </SelectContent>
        </Select>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "p-2 transition-colors",
              view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "p-2 transition-colors",
              view === "list" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {isLoading ? (
        <div className={cn(
          view === "grid"
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "flex flex-col gap-2"
        )}>
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} view={view} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed text-destructive gap-4">
          <AlertCircle className="h-10 w-10" />
          <p className="text-sm">加载失败，请重试</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>重新加载</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-2xl border border-dashed gap-4">
          <div className="p-4 rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-muted-foreground">
              {search || statusFilter !== "all" || typeFilter !== "all" ? "没有符合条件的胶囊" : "还没有胶囊"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "尝试调整搜索条件"
                : "添加第一个知识胶囊开始构建你的知识库"}
            </p>
          </div>
          {!search && statusFilter === "all" && typeFilter === "all" && <CreateCapsuleDialog />}
        </div>
      ) : (
        <>
          <div className={cn(
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "flex flex-col gap-2"
          )}>
            {filtered.map((capsule) => (
              <CapsuleCard key={capsule.id} capsule={capsule} view={view} />
            ))}
          </div>
          {filtered.length < total && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              当前过滤显示 {filtered.length} / {total} 个胶囊
            </p>
          )}
        </>
      )}
    </div>
  );
}
