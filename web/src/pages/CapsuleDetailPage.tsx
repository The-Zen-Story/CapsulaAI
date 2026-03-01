import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft, FileText, Globe, Image as ImageIcon, File,
  Loader2, Clock, CheckCircle, AlertCircle, RefreshCw,
  Tag, Users, Zap, Brain, ExternalLink
} from "lucide-react";
import { capsuleService, type Capsule } from "@/services/capsule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  PENDING: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50", label: "Pending" },
  PROCESSING: { icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-50", label: "Processing" },
  COMPLETED: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50", label: "Completed" },
  FAILED: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-50", label: "Failed" },
};

const sourceIcons: Record<string, any> = {
  NOTE: FileText, WEBSITE: Globe, IMAGE: ImageIcon, PDF: File,
};

export default function CapsuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: capsule, isLoading, error } = useQuery({
    queryKey: ["capsule", id],
    queryFn: () => capsuleService.getById(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "PROCESSING" ? 3000 : false;
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: () => capsuleService.reprocess(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capsule", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !capsule) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive space-y-4">
        <AlertCircle className="h-8 w-8" />
        <p>Capsule not found</p>
        <Button variant="outline" onClick={() => navigate("/capsules")}>Back to Capsules</Button>
      </div>
    );
  }

  const status = statusConfig[capsule.status] || statusConfig.PENDING;
  const StatusIcon = status.icon;
  const primarySource = capsule.sourceTypes?.[0] || capsule.sourceType || "NOTE";
  const SourceIcon = sourceIcons[primarySource] || FileText;
  const sd = capsule.structuredData;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold tracking-tight truncate">
            {capsule.summary || sd?.meta?.title || sd?.content?.title || "Untitled Capsule"}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <SourceIcon className="h-4 w-4" />
            <span>{capsule.sourceType}</span>
            <span>•</span>
            <span>{format(new Date(capsule.createdAt), "PPP 'at' HH:mm")}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => reprocessMutation.mutate()}
            disabled={reprocessMutation.isPending}
          >
            {reprocessMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reprocess
          </Button>

          <Badge variant="outline" className={cn("gap-1", status.bg, status.color)}>
            <StatusIcon className={cn("h-3 w-3", capsule.status === "PROCESSING" && "animate-spin")} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Processing State */}
      {(capsule.status === "PENDING" || capsule.status === "PROCESSING") && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <p className="font-medium text-blue-700">Processing in progress...</p>
                <p className="text-sm text-blue-600">The AI is analyzing this content. This page will auto-update.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
            >
              {reprocessMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Failed State with Retry */}
      {capsule.status === "FAILED" && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-700">Processing failed</p>
                <p className="text-sm text-red-600">An error occurred while analyzing this content.</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => reprocessMutation.mutate()}
              disabled={reprocessMutation.isPending}
            >
              {reprocessMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Assets (Images) */}
      {capsule.assets && capsule.assets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Attachments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {capsule.assets.map((asset) => (
                <AssetPreview key={asset.id} asset={asset} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary & Content */}
      {sd?.content && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5" /> AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sd.content.summary && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">Summary</h4>
                <p className="text-sm leading-relaxed">{sd.content.summary}</p>
              </div>
            )}
            {sd.content.key_facts && sd.content.key_facts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">Key Facts</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {sd.content.key_facts.map((fact: string, i: number) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}
            {sd.content.categories && sd.content.categories.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-1">Categories</h4>
                <div className="flex flex-wrap gap-1">
                  {sd.content.categories.map((cat: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{cat}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extracted Entities */}
      {capsule.capsuleEntities && capsule.capsuleEntities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Extracted Entities ({capsule.capsuleEntities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {capsule.capsuleEntities.map((link: any, i: number) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="gap-1 py-1 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => navigate(`/entities/${link.entity.type.toLowerCase()}/${encodeURIComponent(link.entity.canonicalName)}`)}
                >
                  <span className="text-[10px] uppercase text-muted-foreground">{link.entity.type}</span>
                  <span>{link.entity.canonicalName}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Relations */}
      {capsule.capsuleRelations && capsule.capsuleRelations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" /> Extracted Relations ({capsule.capsuleRelations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {capsule.capsuleRelations.map((link: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-accent/30 text-sm">
                  <span
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => navigate(`/entities/${link.relation.fromEntity.type.toLowerCase()}/${encodeURIComponent(link.relation.fromEntity.canonicalName)}`)}
                  >
                    {link.relation.fromEntity.canonicalName}
                  </span>
                  <Badge variant="secondary" className="text-[10px] shrink-0 uppercase">
                    {link.relation.relationType}
                  </Badge>
                  <span
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => navigate(`/entities/${link.relation.toEntity.type.toLowerCase()}/${encodeURIComponent(link.relation.toEntity.canonicalName)}`)}
                  >
                    {link.relation.toEntity.canonicalName}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {sd?.actions && sd.actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" /> Actions ({sd.actions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sd.actions.map((action: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-accent/30">
                  <Badge variant="secondary" className="text-[10px] shrink-0">{action.type}</Badge>
                  <div>
                    <p className="text-sm font-medium">{action.description || action.text}</p>
                    {action.deadline && (
                      <p className="text-xs text-muted-foreground">Due: {action.deadline}</p>
                    )}
                    {action.priority && (
                      <Badge variant="outline" className="text-[10px] mt-0.5">{action.priority}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Original Content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> Original Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {capsule.rawContent || capsule.originalContent || "(no content)"}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">ID:</span> <code className="text-[10px]">{capsule.id}</code></div>
            <div><span className="text-muted-foreground">Source:</span> {capsule.sourceType}</div>
            <div><span className="text-muted-foreground">Created:</span> {format(new Date(capsule.createdAt), "PPP HH:mm:ss")}</div>
            <div><span className="text-muted-foreground">Updated:</span> {format(new Date(capsule.updatedAt), "PPP HH:mm:ss")}</div>
            {capsule.qualityScore != null && (
              <div><span className="text-muted-foreground">Quality:</span> {capsule.qualityScore}/5</div>
            )}
            {sd?.schema_version && (
              <div><span className="text-muted-foreground">Schema:</span> {sd.schema_version}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AssetPreview({ asset }: { asset: Capsule["assets"] extends (infer T)[] | undefined ? T : never }) {
  // The backend streams the file directly at /api/uploads/:objectName
  // The Vite proxy forwards /api/* to the backend, so we use the relative path
  const assetUrl = `/api/uploads/${asset.storagePath}`;

  if (asset.mimeType?.startsWith("image/")) {
    return (
      <div className="rounded-lg overflow-hidden border bg-muted/30">
        <img
          src={assetUrl}
          alt={asset.fileName || "asset"}
          className="w-full h-auto max-h-96 object-contain bg-white"
          onError={(e) => {
            // Hide broken image, show fallback
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
        <div className="hidden flex items-center justify-center h-48 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <span className="ml-2 text-sm">Failed to load image</span>
        </div>
        <div className="p-2 text-xs text-muted-foreground truncate">
          {asset.fileName || asset.storagePath} ({(asset.size / 1024).toFixed(1)} KB)
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <File className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium truncate">{asset.fileName || asset.storagePath}</p>
        <p className="text-xs text-muted-foreground">{asset.mimeType} • {(asset.size / 1024).toFixed(1)} KB</p>
      </div>
    </div>
  );
}

