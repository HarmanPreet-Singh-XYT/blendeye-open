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
import {
  getLocalAssets,
  uploadAssetFile,
  type CinemaAsset,
  type AssetCategory,
  type AssetType,
  ASSET_CATEGORIES,
} from "@/lib/asset-store";
import {
  Upload,
  Search,
  Check,
  Film,
  Image as ImageIcon,
  MapPin,
  User,
  Sparkles,
  Video,
  X,
  Loader2,
  FolderOpen,
} from "lucide-react";

interface AssetPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  acceptedCategories?: AssetCategory[];
  acceptedTypes?: AssetType[];
  selectedAssetId?: string | null;
  onSelectAsset: (asset: CinemaAsset) => void;
  projectId?: string;
}

export function AssetPickerModal({
  open,
  onOpenChange,
  title = "Select Reference Asset",
  description = "Choose an existing asset from your production hub or upload a new file.",
  acceptedCategories,
  acceptedTypes,
  selectedAssetId,
  onSelectAsset,
  projectId,
}: AssetPickerModalProps) {
  const [activeTab, setActiveTab] = React.useState<"library" | "upload">("library");
  const [assets, setAssets] = React.useState<CinemaAsset[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  // Upload state
  const [isUploading, setIsUploading] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadCategory, setUploadCategory] = React.useState<AssetCategory>(
    acceptedCategories?.[0] || "general"
  );
  const [uploadName, setUploadName] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load assets
  const loadAssets = React.useCallback(() => {
    const list = getLocalAssets();
    setAssets(list);
  }, []);

  React.useEffect(() => {
    if (open) {
      loadAssets();
      if (acceptedCategories && acceptedCategories.length === 1) {
        setSelectedCategory(acceptedCategories[0]);
        setUploadCategory(acceptedCategories[0]);
      } else {
        setSelectedCategory("all");
      }
    }
  }, [open, acceptedCategories, loadAssets]);

  // Listen to store updates
  React.useEffect(() => {
    const handleUpdate = () => loadAssets();
    window.addEventListener("cinema-assets-updated", handleUpdate);
    return () => window.removeEventListener("cinema-assets-updated", handleUpdate);
  }, [loadAssets]);

  // Filtered assets
  const filteredAssets = React.useMemo(() => {
    return assets.filter((asset) => {
      // Type constraint
      if (acceptedTypes && acceptedTypes.length > 0 && !acceptedTypes.includes(asset.type)) {
        return false;
      }
      // Category constraint from props
      if (acceptedCategories && acceptedCategories.length > 0 && !acceptedCategories.includes(asset.category)) {
        return false;
      }
      // Category tab filter
      if (selectedCategory !== "all" && asset.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = asset.name.toLowerCase().includes(q);
        const matchTag = asset.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchTag) return false;
      }
      return true;
    });
  }, [assets, acceptedTypes, acceptedCategories, selectedCategory, searchQuery]);

  // Upload handler
  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const asset = await uploadAssetFile(file, {
        name: uploadName.trim() || undefined,
        category: uploadCategory,
        projectId,
      });

      toast.add({
        title: "Asset Uploaded",
        description: `"${asset.name}" ready in your asset hub.`,
        type: "success",
      });

      onSelectAsset(asset);
      onOpenChange(false);
    } catch (err) {
      console.error("Upload error:", err);
      toast.add({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Could not upload file.",
        type: "error",
      });
    } finally {
      setIsUploading(false);
      setUploadName("");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[94vw] max-h-[85vh] h-[650px] p-0 flex flex-col bg-[#0b0c10] border-border/80 text-foreground overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-secondary/10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <FolderOpen className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                  <span>{title}</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-accent/40 text-accent">
                    {filteredAssets.length} available
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
                  {description}
                </DialogDescription>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center bg-secondary/40 p-0.5 rounded-lg border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("library")}
                className={`px-3 py-1 rounded-md transition-all font-medium ${
                  activeTab === "library"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Production Library
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("upload")}
                className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                  activeTab === "upload"
                    ? "bg-accent text-accent-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="h-3 w-3" />
                <span>Upload New</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        {activeTab === "library" ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Search & Category Filter Bar */}
            <div className="p-3 border-b border-border/50 bg-secondary/15 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets by name or tag..."
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

              {/* Filter chips */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    selectedCategory === "all"
                      ? "bg-accent/20 text-accent border border-accent/40"
                      : "text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  All
                </button>
                {(!acceptedCategories || acceptedCategories.includes("map")) && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("map")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                      selectedCategory === "map"
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    Maps &amp; Blueprints
                  </button>
                )}
                {(!acceptedCategories || acceptedCategories.includes("character_face")) && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("character_face")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                      selectedCategory === "character_face"
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    <User className="h-2.5 w-2.5" />
                    Faces
                  </button>
                )}
                {(!acceptedCategories || acceptedCategories.includes("location")) && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("location")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                      selectedCategory === "location"
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    <ImageIcon className="h-2.5 w-2.5" />
                    Locations
                  </button>
                )}
                {(!acceptedCategories || acceptedCategories.includes("video")) && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("video")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                      selectedCategory === "video"
                        ? "bg-accent/20 text-accent border border-accent/40"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    <Video className="h-2.5 w-2.5" />
                    Videos
                  </button>
                )}
              </div>
            </div>

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredAssets.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="h-12 w-12 rounded-full bg-secondary/50 border border-border flex items-center justify-center text-muted-foreground">
                    <Film className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">No assets found</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs">
                      Try changing your search query or switch to the &quot;Upload New&quot; tab to add files.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("upload")}
                    className="text-xs gap-1.5"
                  >
                    <Upload className="h-3 w-3" />
                    Upload File
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredAssets.map((asset) => {
                    const isSelected = selectedAssetId === asset.id;
                    return (
                      <div
                        key={asset.id}
                        onClick={() => {
                          onSelectAsset(asset);
                          onOpenChange(false);
                        }}
                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${
                          isSelected
                            ? "border-accent ring-2 ring-accent/30 bg-accent/10"
                            : "border-border/70 bg-[#12131a] hover:border-accent/60 hover:bg-[#161822]"
                        }`}
                      >
                        {/* Media Preview Box */}
                        <div className="relative aspect-video w-full bg-black/40 overflow-hidden">
                          {asset.type === "video" ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/70">
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
                              <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-white pointer-events-none">
                                <Video className="h-3 w-3" />
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

                          {isSelected && (
                            <div className="absolute top-1.5 left-1.5 h-5 w-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-md">
                              <Check className="h-3 w-3" />
                            </div>
                          )}

                          <Badge
                            variant="secondary"
                            className="absolute bottom-1.5 left-1.5 text-[9px] bg-black/70 text-white/90 border-black/40 font-mono py-0"
                          >
                            {asset.category.replace("_", " ")}
                          </Badge>
                        </div>

                        {/* Title & Info */}
                        <div className="p-2.5 space-y-1">
                          <p className="text-xs font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                            {asset.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{asset.type.toUpperCase()}</span>
                            {asset.sizeBytes ? (
                              <span>{(asset.sizeBytes / 1024).toFixed(0)} KB</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Upload New View */
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-accent bg-accent/15 scale-[0.99]"
                  : "border-border/80 bg-secondary/15 hover:border-accent/60 hover:bg-secondary/25"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={
                  acceptedTypes?.includes("video") && acceptedTypes.length === 1
                    ? "video/*"
                    : acceptedTypes?.includes("image") && acceptedTypes.length === 1
                    ? "image/*"
                    : "image/*,video/*,application/pdf,.svg"
                }
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadFile(e.target.files[0]);
                  }
                }}
              />

              <div className="h-14 w-14 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent mb-3 shadow-inner">
                {isUploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-accent" />
                ) : (
                  <Upload className="h-7 w-7" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {isUploading ? "Uploading to Production Storage..." : "Drag and drop your file here"}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Supports architectural building blueprints, top-level maps, actor headshots, concept plates, video takes (MP4, PNG, JPG, WEBP, SVG).
                </p>
              </div>

              {!isUploading && (
                <Button size="sm" className="mt-4 text-xs font-medium cursor-pointer">
                  Browse Files from Computer
                </Button>
              )}
            </div>

            {/* Upload Settings / Category Tag */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Asset Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="map">Building Map / Architectural Blueprint</option>
                  <option value="character_face">Character Face / Headshot</option>
                  <option value="character_body">Character Wardrobe / Full-Body</option>
                  <option value="location">Location Scouting Plate</option>
                  <option value="style">Style / Color Moodboard Reference</option>
                  <option value="video">Video Take / B-Roll</option>
                  <option value="general">General Production Media</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Custom Asset Title (Optional)
                </label>
                <Input
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="e.g. 2nd Floor Bank Vault Perimeter"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
