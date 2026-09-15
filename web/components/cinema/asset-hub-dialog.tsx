"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { SlateLabel } from "@/components/cinema/slate-label";
import {
  getLocalAssets,
  saveLocalAsset,
  deleteLocalAsset,
  uploadAssetFile,
  type CinemaAsset,
  type AssetCategory,
  ASSET_CATEGORIES,
} from "@/lib/asset-store";
import {
  FolderOpen,
  Upload,
  Search,
  Check,
  Film,
  Image as ImageIcon,
  MapPin,
  User,
  Sparkles,
  Video,
  Volume2,
  Trash2,
  Download,
  ExternalLink,
  Copy,
  Maximize2,
  Filter,
  Sliders,
  Play,
  Pause,
  X,
  Plus,
  Loader2,
  Shirt,
  Building2,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface AssetHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  projectTitle?: string;
  onSetFloorPlanMap?: (mapUrl: string, asset: CinemaAsset) => void;
  onSendToVideo?: (imageUrl: string, asset: CinemaAsset) => void;
  onSetCharacterFace?: (imageUrl: string, asset: CinemaAsset) => void;
  onAddToSceneScout?: (imageUrl: string, asset: CinemaAsset) => void;
  onInsertToTimeline?: (mediaUrl: string, asset: CinemaAsset) => void;
  onAddToLyraScore?: (imageUrl: string, asset: CinemaAsset) => void;
}

export function AssetHubDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onSetFloorPlanMap,
  onSendToVideo,
  onSetCharacterFace,
  onAddToSceneScout,
  onInsertToTimeline,
  onAddToLyraScore,
}: AssetHubDialogProps) {
  const [assets, setAssets] = React.useState<CinemaAsset[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedAsset, setSelectedAsset] = React.useState<CinemaAsset | null>(null);

  // Upload modal state
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [dragActive, setDragActive] = React.useState<boolean>(false);
  const [uploadCategory, setUploadCategory] = React.useState<AssetCategory>("map");
  const [uploadTitle, setUploadTitle] = React.useState<string>("");
  const [showUploadPanel, setShowUploadPanel] = React.useState<boolean>(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load assets
  const loadAssets = React.useCallback(() => {
    const list = getLocalAssets();
    setAssets(list);
  }, []);

  React.useEffect(() => {
    if (open) {
      loadAssets();
    }
  }, [open, loadAssets]);

  // Sync when event fired
  React.useEffect(() => {
    const handleUpdate = () => loadAssets();
    window.addEventListener("cinema-assets-updated", handleUpdate);
    return () => window.removeEventListener("cinema-assets-updated", handleUpdate);
  }, [loadAssets]);

  // Filtered assets
  const filteredAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      if (selectedCategory !== "all" && asset.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(q);
        const matchTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchTag) return false;
      }
      return true;
    });
  }, [assets, selectedCategory, searchQuery]);

  // Upload handler
  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const asset = await uploadAssetFile(file, {
        name: uploadTitle.trim() || undefined,
        category: uploadCategory,
        projectId,
      });

      toast.add({
        title: "Asset Added to Hub",
        description: `"${asset.name}" is now ready for cross-referencing.`,
        type: "success",
      });

      setSelectedAsset(asset);
      setShowUploadPanel(false);
      setUploadTitle("");
    } catch (err) {
      console.error("Asset upload error:", err);
      toast.add({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload asset.",
        type: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAsset = (asset: CinemaAsset) => {
    deleteLocalAsset(asset.id);
    if (selectedAsset?.id === asset.id) {
      setSelectedAsset(null);
    }
    toast.add({
      title: "Asset Removed",
      description: `"${asset.name}" removed from local store.`,
      type: "neutral",
    });
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.add({
      title: "Asset URL Copied",
      description: "Direct URL copied to clipboard.",
      type: "success",
    });
  };

  // Category counts
  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: assets.length };
    for (const a of assets) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return counts;
  }, [assets]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] h-[820px] p-0 flex flex-col bg-[#0b0c10] border-border/80 text-foreground overflow-hidden shadow-2xl">
        {/* Top Header Bar */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-[#0e1017] shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-inner">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                    Production Asset Hub
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] font-mono border-accent/40 text-accent">
                    {assets.length} Total Assets
                  </Badge>
                  {projectTitle && (
                    <Badge variant="secondary" className="text-[10px] font-mono hidden md:inline-flex">
                      {projectTitle}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  Centralized repository for building maps, actor headshots, location plates, and media conditioning inputs.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Upload Action */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setShowUploadPanel(!showUploadPanel)}
                className="text-xs h-8.5 gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground font-medium cursor-pointer shadow-md"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{showUploadPanel ? "Close Upload Tray" : "Upload Assets"}</span>
              </Button>
            </div>
          </div>

          {/* Inline Drag & Drop Upload Drawer */}
          {showUploadPanel && (
            <div className="mt-4 p-4 rounded-xl border border-accent/40 bg-accent/5 animate-in fade-in-50 duration-200 space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div
                  onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    if (e.dataTransfer.files?.[0]) handleUploadFile(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    dragActive
                      ? "border-accent bg-accent/20"
                      : "border-border hover:border-accent/60 bg-background/60 hover:bg-background/90"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,application/pdf,.svg"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadFile(e.target.files[0]);
                    }}
                  />
                  {isUploading ? (
                    <div className="flex items-center gap-2 text-accent text-xs font-semibold">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading to Production Storage...</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground flex items-center justify-center gap-1.5">
                        <Upload className="h-3.5 w-3.5 text-accent" />
                        <span>Drop file here or click to browse</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Building blueprints, character likeness photos, scouting plates, video takes (PNG, JPG, MP4, SVG).
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Config Options */}
                <div className="w-full sm:w-72 space-y-2 shrink-0">
                  <div>
                    <label className="text-[11px] font-mono text-muted-foreground uppercase block mb-1">
                      Destination Category
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
                      className="w-full h-8 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    >
                      <option value="map">Building Map / Architectural Blueprint</option>
                      <option value="character_face">Character Face / Headshot</option>
                      <option value="character_body">Character Wardrobe / Body</option>
                      <option value="location">Location Scouting Plate</option>
                      <option value="style">Style / Color Moodboard</option>
                      <option value="video">Video Take / B-Roll</option>
                      <option value="general">General Media</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-muted-foreground uppercase block mb-1">
                      Label / Title (Optional)
                    </label>
                    <Input
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. Sub-Level 2 Security Perimeter"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Main Workspace Layout: Category Sidebar + Media Grid */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Category Rail */}
          <div className="w-56 border-r border-border/70 bg-[#0d0e14] p-3 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground px-2 py-1 block">
                Vault Categories
              </span>
              {ASSET_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full p-2 rounded-lg text-left text-xs transition-all flex items-center justify-between group ${
                      isSelected
                        ? "bg-secondary text-foreground border border-accent/40 shadow-xs font-semibold"
                        : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {cat.id === "map" && <MapPin className="h-3.5 w-3.5 text-accent" />}
                      {cat.id === "character_face" && <User className="h-3.5 w-3.5 text-blue-400" />}
                      {cat.id === "character_body" && <Shirt className="h-3.5 w-3.5 text-indigo-400" />}
                      {cat.id === "location" && <Building2 className="h-3.5 w-3.5 text-emerald-400" />}
                      {cat.id === "style" && <Sparkles className="h-3.5 w-3.5 text-amber-400" />}
                      {cat.id === "video" && <Video className="h-3.5 w-3.5 text-purple-400" />}
                      {cat.id === "audio" && <Volume2 className="h-3.5 w-3.5 text-rose-400" />}
                      {cat.id === "all" && <Layers className="h-3.5 w-3.5 text-accent" />}
                      <span className="truncate">{cat.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Storage Status Footer */}
            <div className="p-2.5 rounded-lg border border-border/50 bg-secondary/15 space-y-1 mt-4">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">
                Vault Status
              </span>
              <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ready for Generative AI</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Linked to Omni Flash, 2D Floor Plan, Scene Scout, and Talent Vault.
              </p>
            </div>
          </div>

          {/* Right Main Grid & Preview Area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#0b0c10]">
            {/* Search and Filter Bar */}
            <div className="p-3 border-b border-border/60 bg-secondary/15 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter assets by name, tag, or character comp..."
                  className="pl-8 h-8 text-xs bg-background/80 border-border/70"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Showing {filteredAssets.length} items</span>
              </div>
            </div>

            {/* Media Cards Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {filteredAssets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="h-14 w-14 rounded-2xl bg-secondary/50 border border-border flex items-center justify-center text-muted-foreground">
                    <FolderOpen className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No assets in this category</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Upload your architectural building maps, actor headshots, or video takes to populate this category.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setShowUploadPanel(true)}
                    className="text-xs gap-1.5"
                  >
                    <Upload className="h-3 w-3" />
                    Upload to this Category
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredAssets.map((asset) => {
                    const isSelected = selectedAsset?.id === asset.id;
                    return (
                      <div
                        key={asset.id}
                        className={`group relative rounded-xl border transition-all overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? "border-accent ring-2 ring-accent/30 bg-[#141620]"
                            : "border-border/80 bg-[#10121a] hover:border-accent/60 hover:bg-[#151722]"
                        }`}
                      >
                        {/* Media Viewport */}
                        <div
                          className="relative aspect-video w-full bg-black/60 overflow-hidden cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          {asset.type === "video" ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/80">
                              <video
                                src={asset.url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                                onMouseLeave={(e) => {
                                  const v = e.currentTarget as HTMLVideoElement;
                                  v.pause();
                                  v.currentTime = 0;
                                }}
                              />
                              <div className="absolute top-2 right-2 p-1 rounded-md bg-black/70 text-white pointer-events-none">
                                <Video className="h-3.5 w-3.5 text-purple-400" />
                              </div>
                            </div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={asset.thumbnailUrl || asset.url}
                              alt={asset.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}

                          {/* Category Badge Overlay */}
                          <Badge
                            variant="secondary"
                            className="absolute bottom-2 left-2 text-[9px] bg-black/75 text-white border-black/40 font-mono py-0"
                          >
                            {asset.category.replace("_", " ")}
                          </Badge>

                          {/* Quick hover trigger */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                            <span className="text-[11px] font-medium text-white bg-black/70 px-2.5 py-1 rounded-md border border-white/20">
                              View Asset
                            </span>
                          </div>
                        </div>

                        {/* Metadata & Actions */}
                        <div className="p-3 space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                              {asset.name}
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-0.5">
                              <span>{asset.type.toUpperCase()}</span>
                              {asset.sizeBytes ? (
                                <span>{(asset.sizeBytes / 1024).toFixed(0)} KB</span>
                              ) : null}
                            </div>
                          </div>

                          {/* Quick Actions Dropdown */}
                          <div className="flex items-center justify-between pt-1 border-t border-border/50">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="inline-flex items-center justify-between h-7 text-[11px] px-2 gap-1 text-accent font-medium w-full rounded-md bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer">
                                <span>Use In...</span>
                                <ArrowRight className="h-3 w-3" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 bg-[#111219] border-border/80">
                                <DropdownMenuLabel className="text-[10px] font-mono uppercase text-muted-foreground">
                                  Link into Pipeline
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />

                                {onSetFloorPlanMap && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onSetFloorPlanMap(asset.url, asset);
                                      toast.add({
                                        title: "Floor Plan Background Linked",
                                        description: `"${asset.name}" active on 2D Blocking canvas.`,
                                        type: "success",
                                      });
                                    }}
                                    className="text-xs gap-2 cursor-pointer"
                                  >
                                    <MapPin className="h-3.5 w-3.5 text-accent" />
                                    <span>Set as 2D Floor Plan Map</span>
                                  </DropdownMenuItem>
                                )}

                                {onSendToVideo && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onSendToVideo(asset.url, asset);
                                      toast.add({
                                        title: "Conditioning the render",
                                        description: `"${asset.name}" sent to the video motion synthesizer.`,
                                        type: "success",
                                      });
                                    }}
                                    className="text-xs gap-2 cursor-pointer"
                                  >
                                    <Film className="h-3.5 w-3.5 text-purple-400" />
                                    <span>Pre-viz in Gemini Omni Flash</span>
                                  </DropdownMenuItem>
                                )}

                                {onSetCharacterFace && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onSetCharacterFace(asset.url, asset);
                                      toast.add({
                                        title: "Character Face Linked",
                                        description: `"${asset.name}" set in Character Lab.`,
                                        type: "success",
                                      });
                                    }}
                                    className="text-xs gap-2 cursor-pointer"
                                  >
                                    <User className="h-3.5 w-3.5 text-blue-400" />
                                    <span>Set as Character Face / Comp</span>
                                  </DropdownMenuItem>
                                )}

                                {onAddToSceneScout && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onAddToSceneScout(asset.url, asset);
                                      toast.add({
                                        title: "Location Plate Added",
                                        description: `"${asset.name}" added to Scene Scout.`,
                                        type: "success",
                                      });
                                    }}
                                    className="text-xs gap-2 cursor-pointer"
                                  >
                                    <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Add to Scene Scout Gallery</span>
                                  </DropdownMenuItem>
                                )}

                                {onInsertToTimeline && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onInsertToTimeline(asset.url, asset);
                                      toast.add({
                                        title: "Moment Placed on Timeline",
                                        description: `"${asset.name}" inserted into scene timeline.`,
                                        type: "success",
                                      });
                                    }}
                                    className="text-xs gap-2 cursor-pointer"
                                  >
                                    <Sliders className="h-3.5 w-3.5 text-amber-400" />
                                    <span>Insert to Timeline Canvas</span>
                                  </DropdownMenuItem>
                                )}

                                {onAddToLyraScore && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onAddToLyraScore(asset.url, asset);
                                      toast.add({
                                        title: "Conditioning Lyra 3 Score",
                                        description: `"${asset.name}" added to musical moodboard.`,
                                        type: "success",
                                      });
                                    }}
                                    className="text-xs gap-2 cursor-pointer"
                                  >
                                    <Sparkles className="h-3.5 w-3.5 text-rose-400" />
                                    <span>Condition Lyria 3 Music</span>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCopyUrl(asset.url)}
                                  className="text-xs gap-2 cursor-pointer"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy Asset URL</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleDeleteAsset(asset)}
                                  className="text-xs gap-2 text-destructive cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Remove Asset</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Asset Lightbox / Inspector Dialog */}
        {selectedAsset && (
          <Dialog open={Boolean(selectedAsset)} onOpenChange={(open) => !open && setSelectedAsset(null)}>
            <DialogContent className="max-w-2xl bg-[#0e1017] border-border/80 text-foreground">
              <DialogHeader>
                <DialogTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>{selectedAsset.name}</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {selectedAsset.category.replace("_", " ")}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Asset ID: {selectedAsset.id} · Added {new Date(selectedAsset.createdAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Media Container */}
                <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border bg-black flex items-center justify-center">
                  {selectedAsset.type === "video" ? (
                    <video
                      src={selectedAsset.url}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedAsset.url}
                      alt={selectedAsset.name}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Tags & Metadata */}
                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAsset.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-mono">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(selectedAsset.url)}
                    className="text-xs gap-1.5"
                  >
                    <Copy className="h-3 w-3" />
                    Copy URL
                  </Button>

                  <div className="flex items-center gap-2">
                    {onSetFloorPlanMap && selectedAsset.category === "map" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          onSetFloorPlanMap(selectedAsset.url, selectedAsset);
                          setSelectedAsset(null);
                          onOpenChange(false);
                        }}
                        className="text-xs gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <MapPin className="h-3 w-3" />
                        Apply to 2D Floor Plan
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAsset(null)}
                      className="text-xs"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
