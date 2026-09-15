"use client";

import * as React from "react";
import { SlateLabel } from "@/components/cinema/slate-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Eye,
  Sparkles,
  RefreshCw,
  Film,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Move,
  Crosshair,
  ImageIcon,
  ShieldAlert,
  Layers,
  Sliders,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  Upload,
  Grid,
  Plus,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { notifyIfFallback } from "@/lib/fallback-notice";
import type { ShotItem, ShotlistResponse } from "@/lib/agent-service";
import { AssetPickerModal } from "@/components/cinema/asset-picker-modal";
import { type CinemaAsset } from "@/lib/asset-store";

/* -------------------------------------------------------------------------
   Data Structures & Types
   ------------------------------------------------------------------------- */

export interface FloorPlanCharacter {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  angle: number; // degrees 0-360
  color: string;
}

export interface CameraSetup {
  id: string;
  name: string;
  focalLength: number; // in mm: 18, 24, 35, 50, 85, 135
  lensName: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  fov: number; // degrees computed from focal length
  height: "low" | "eye" | "high" | "dutch";
  motion: string;
}

export interface PracticalLight {
  id: string;
  name: string;
  x: number;
  y: number;
  type: "key" | "fill" | "practical" | "ambient";
  color: string;
  intensity: number;
}

export interface StageProp {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface PrecedentComp {
  film: string;
  director: string;
  scene_comparison: string;
  lens_and_blocking_technique: string;
}

export interface LocationScoutData {
  film_precedents?: PrecedentComp[];
  location_aesthetic?: string;
  practical_lighting?: string;
  camera_package?: {
    cam_a: string;
    cam_b: string;
    cam_c: string;
  };
}

export interface FloorPlanMapConfig {
  opacity?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  invert?: boolean;
  showGrid?: boolean;
}

export interface FloorPlanViewProps {
  sceneTitle: string;
  characters?: Array<{ name: string; archetype?: string }>;
  primaryLocation?: string;
  screenplayText?: string;
  directorStyle?: string;
  className?: string;
  initialMapUrl?: string | null;
  initialMapName?: string;
  initialMapConfig?: FloorPlanMapConfig;
  onMapChange?: (mapUrl: string | null, mapName?: string) => void;
  onMapConfigChange?: (config: FloorPlanMapConfig) => void;
  onSendToVideo?: (camData: {
    camName: string;
    lens: string;
    motion: string;
    promptNote: string;
  }) => void;
}

// Convert focal length (mm) on standard 35mm sensor to horizontal FOV degrees
function focalToFov(focalMm: number): number {
  const sensorWidth = 36;
  const rad = 2 * Math.atan(sensorWidth / (2 * focalMm));
  return Math.round((rad * 180) / Math.PI);
}

const LENS_PRESETS = [
  { mm: 18, label: "18mm Ultra-Wide", fov: 90 },
  { mm: 24, label: "24mm Wide Anamorphic", fov: 74 },
  { mm: 35, label: "35mm Master Prime", fov: 54 },
  { mm: 50, label: "50mm Standard Prime", fov: 40 },
  { mm: 85, label: "85mm Portrait Telephoto", fov: 24 },
  { mm: 135, label: "135mm Compression", fov: 15 },
];

const MOTION_PRESETS = [
  "Slow Creeping Dolly In",
  "Lateral Steadicam Track",
  "Static Master Lock-Off",
  "Handheld Dutch Drift",
  "High Crane Jib Down",
  "Whip Pan to Reveal",
];

const HEIGHT_PRESETS: Array<{ id: CameraSetup["height"]; label: string; desc: string }> = [
  { id: "eye", label: "Eye Level", desc: "Neutral objective" },
  { id: "low", label: "Low Angle (+15°)", desc: "Empowers subject" },
  { id: "high", label: "High Angle (-20°)", desc: "Vulnerability context" },
  { id: "dutch", label: "Dutch Tilt (12° Roll)", desc: "Claustrophobic tension" },
];

export const FALLBACK_CAM: CameraSetup = {
  id: "cam-a",
  name: "Cam A · Wide Master",
  focalLength: 35,
  lensName: "35mm T1.5 Anamorphic Master",
  x: 480,
  y: 280,
  targetX: 490,
  targetY: 170,
  fov: 54,
  height: "eye",
  motion: "Slow Creeping Dolly In",
};

// Pure layout generator for initial state & preset resets
function getLayoutPreset(
  presetName: "dialogue" | "triangle" | "interrogation" | "walk",
  characters: Array<{ name: string; archetype?: string }>,
  roomX: number,
  roomY: number,
  roomW: number,
  roomH: number
): {
  chars: FloorPlanCharacter[];
  cameras: CameraSetup[];
  lights: PracticalLight[];
  props: StageProp[];
} {
  const charA = characters[0]?.name || "Lead Subject";
  const charB = characters[1]?.name || "Counterpart";
  const charC = characters[2]?.name || "Third Party";

  if (presetName === "triangle") {
    return {
      chars: [
        {
          id: "char-0",
          name: charA,
          role: "Point A",
          x: Math.round(roomX + roomW * 0.35),
          y: Math.round(roomY + roomH * 0.65),
          angle: 45,
          color: "#f59e0b",
        },
        {
          id: "char-1",
          name: charB,
          role: "Point B",
          x: Math.round(roomX + roomW * 0.65),
          y: Math.round(roomY + roomH * 0.65),
          angle: 135,
          color: "#10b981",
        },
        {
          id: "char-2",
          name: charC,
          role: "Apex C",
          x: Math.round(roomX + roomW * 0.5),
          y: Math.round(roomY + roomH * 0.3),
          angle: 270,
          color: "#06b6d4",
        },
      ],
      cameras: [
        {
          id: "cam-a",
          name: "Cam A · Low Hero Master",
          focalLength: 24,
          lensName: "24mm Wide Anamorphic",
          x: Math.round(roomX + roomW * 0.5),
          y: Math.round(roomY + roomH * 0.88),
          targetX: Math.round(roomX + roomW * 0.5),
          targetY: Math.round(roomY + roomH * 0.52),
          fov: 74,
          height: "low",
          motion: "Slow Creeping Dolly In",
        },
        {
          id: "cam-b",
          name: "Cam B · Cross Apex Tight",
          focalLength: 85,
          lensName: "85mm Portrait Telephoto",
          x: Math.round(roomX + roomW * 0.42),
          y: Math.round(roomY + roomH * 0.6),
          targetX: Math.round(roomX + roomW * 0.5),
          targetY: Math.round(roomY + roomH * 0.3),
          fov: 24,
          height: "eye",
          motion: "Handheld Dutch Drift",
        },
        {
          id: "cam-c",
          name: "Cam C · Profile Pivot",
          focalLength: 50,
          lensName: "50mm Standard Prime",
          x: Math.round(roomX + roomW * 0.78),
          y: Math.round(roomY + roomH * 0.45),
          targetX: Math.round(roomX + roomW * 0.35),
          targetY: Math.round(roomY + roomH * 0.65),
          fov: 40,
          height: "dutch",
          motion: "Whip Pan to Reveal",
        },
      ],
      props: [
        {
          id: "prop-1",
          name: "Contested Centerpiece",
          x: Math.round(roomX + roomW * 0.46),
          y: Math.round(roomY + roomH * 0.48),
          w: Math.round(roomW * 0.08),
          h: Math.round(roomH * 0.12),
          label: "CONTESTED ASSET",
        },
      ],
      lights: [
        {
          id: "light-1",
          name: "Top-Down Overhead Practical",
          x: Math.round(roomX + roomW * 0.5),
          y: Math.round(roomY + roomH * 0.48),
          type: "key",
          color: "#38bdf8",
          intensity: 100,
        },
      ],
    };
  }

  if (presetName === "interrogation") {
    return {
      chars: [
        {
          id: "char-0",
          name: charA,
          role: "Investigator (Pacing)",
          x: Math.round(roomX + roomW * 0.4),
          y: Math.round(roomY + roomH * 0.38),
          angle: 110,
          color: "#f59e0b",
        },
        {
          id: "char-1",
          name: charB,
          role: "Detainee (Restrained)",
          x: Math.round(roomX + roomW * 0.52),
          y: Math.round(roomY + roomH * 0.55),
          angle: 270,
          color: "#ef4444",
        },
      ],
      cameras: [
        {
          id: "cam-a",
          name: "Cam A · Profile Master",
          focalLength: 35,
          lensName: "35mm Master Prime",
          x: Math.round(roomX + roomW * 0.22),
          y: Math.round(roomY + roomH * 0.52),
          targetX: Math.round(roomX + roomW * 0.52),
          targetY: Math.round(roomY + roomH * 0.55),
          fov: 54,
          height: "eye",
          motion: "Static Master Lock-Off",
        },
        {
          id: "cam-b",
          name: "Cam B · Low Angle Intimidation",
          focalLength: 50,
          lensName: "50mm Standard Prime",
          x: Math.round(roomX + roomW * 0.58),
          y: Math.round(roomY + roomH * 0.72),
          targetX: Math.round(roomX + roomW * 0.4),
          targetY: Math.round(roomY + roomH * 0.38),
          fov: 40,
          height: "low",
          motion: "Slow Creeping Dolly In",
        },
        {
          id: "cam-c",
          name: "Cam C · High Downward Isolation",
          focalLength: 85,
          lensName: "85mm Portrait Telephoto",
          x: Math.round(roomX + roomW * 0.36),
          y: Math.round(roomY + roomH * 0.28),
          targetX: Math.round(roomX + roomW * 0.52),
          targetY: Math.round(roomY + roomH * 0.55),
          fov: 24,
          height: "high",
          motion: "Handheld Dutch Drift",
        },
      ],
      props: [
        {
          id: "prop-1",
          name: "Steel Interrogation Table",
          x: Math.round(roomX + roomW * 0.46),
          y: Math.round(roomY + roomH * 0.5),
          w: Math.round(roomW * 0.16),
          h: Math.round(roomH * 0.14),
          label: "STEEL TABLE",
        },
      ],
      lights: [
        {
          id: "light-1",
          name: "Single Harsh Bulb",
          x: Math.round(roomX + roomW * 0.5),
          y: Math.round(roomY + roomH * 0.5),
          type: "key",
          color: "#f8fafc",
          intensity: 95,
        },
      ],
    };
  }

  if (presetName === "walk") {
    return {
      chars: [
        {
          id: "char-0",
          name: charA,
          role: "Walking Lead",
          x: Math.round(roomX + roomW * 0.56),
          y: Math.round(roomY + roomH * 0.5),
          angle: 0,
          color: "#f59e0b",
        },
        {
          id: "char-1",
          name: charB,
          role: "Walking Counterpart",
          x: Math.round(roomX + roomW * 0.48),
          y: Math.round(roomY + roomH * 0.5),
          angle: 0,
          color: "#10b981",
        },
      ],
      cameras: [
        {
          id: "cam-a",
          name: "Cam A · Leading Steadicam",
          focalLength: 28,
          lensName: "28mm Steadicam Prime",
          x: Math.round(roomX + roomW * 0.78),
          y: Math.round(roomY + roomH * 0.5),
          targetX: Math.round(roomX + roomW * 0.52),
          targetY: Math.round(roomY + roomH * 0.5),
          fov: 65,
          height: "eye",
          motion: "Lateral Steadicam Track",
        },
        {
          id: "cam-b",
          name: "Cam B · Profile Tracking Master",
          focalLength: 50,
          lensName: "50mm Tracking Master",
          x: Math.round(roomX + roomW * 0.52),
          y: Math.round(roomY + roomH * 0.82),
          targetX: Math.round(roomX + roomW * 0.52),
          targetY: Math.round(roomY + roomH * 0.5),
          fov: 40,
          height: "eye",
          motion: "Lateral Steadicam Track",
        },
        {
          id: "cam-c",
          name: "Cam C · High Corner Surveillance",
          focalLength: 85,
          lensName: "85mm Telephoto Security",
          x: Math.round(roomX + roomW * 0.18),
          y: Math.round(roomY + roomH * 0.25),
          targetX: Math.round(roomX + roomW * 0.52),
          targetY: Math.round(roomY + roomH * 0.5),
          fov: 24,
          height: "high",
          motion: "Static Master Lock-Off",
        },
      ],
      props: [
        {
          id: "prop-1",
          name: "North Corridor Wall",
          x: Math.round(roomX + roomW * 0.15),
          y: Math.round(roomY + roomH * 0.28),
          w: Math.round(roomW * 0.7),
          h: 12,
          label: "CORRIDOR PARTITION",
        },
        {
          id: "prop-2",
          name: "South Corridor Wall",
          x: Math.round(roomX + roomW * 0.15),
          y: Math.round(roomY + roomH * 0.72),
          w: Math.round(roomW * 0.7),
          h: 12,
          label: "CORRIDOR PARTITION",
        },
      ],
      lights: [
        {
          id: "light-1",
          name: "Fluorescent Strip A",
          x: Math.round(roomX + roomW * 0.35),
          y: Math.round(roomY + roomH * 0.5),
          type: "practical",
          color: "#06b6d4",
          intensity: 70,
        },
        {
          id: "light-2",
          name: "Fluorescent Strip B",
          x: Math.round(roomX + roomW * 0.65),
          y: Math.round(roomY + roomH * 0.5),
          type: "practical",
          color: "#06b6d4",
          intensity: 70,
        },
      ],
    };
  }

  // Default: Dialogue OTS
  return {
    chars: [
      {
        id: "char-0",
        name: charA,
        role: characters[0]?.archetype ? characters[0].archetype.split(",")[0] : "Protagonist",
        x: Math.round(roomX + roomW * 0.38),
        y: Math.round(roomY + roomH * 0.52),
        angle: 15,
        color: "#f59e0b",
      },
      {
        id: "char-1",
        name: charB,
        role: characters[1]?.archetype ? characters[1].archetype.split(",")[0] : "Antagonist",
        x: Math.round(roomX + roomW * 0.64),
        y: Math.round(roomY + roomH * 0.48),
        angle: 195,
        color: "#10b981",
      },
      ...(characters[2]
        ? [
            {
              id: "char-2",
              name: charC,
              role: characters[2].archetype ? characters[2].archetype.split(",")[0] : "Observer",
              x: Math.round(roomX + roomW * 0.8),
              y: Math.round(roomY + roomH * 0.72),
              angle: 160,
              color: "#06b6d4",
            },
          ]
        : []),
    ],
    cameras: [
      {
        id: "cam-a",
        name: "Cam A · Wide Master",
        focalLength: 35,
        lensName: "35mm T1.5 Anamorphic Master",
        x: Math.round(roomX + roomW * 0.5),
        y: Math.round(roomY + roomH * 0.84),
        targetX: Math.round(roomX + roomW * 0.51),
        targetY: Math.round(roomY + roomH * 0.5),
        fov: 54,
        height: "eye",
        motion: "Slow Creeping Dolly In",
      },
      {
        id: "cam-b",
        name: "Cam B · Reverse OTS (on Lead)",
        focalLength: 50,
        lensName: "50mm T1.3 Prime OTS",
        x: Math.round(roomX + roomW * 0.72),
        y: Math.round(roomY + roomH * 0.35),
        targetX: Math.round(roomX + roomW * 0.38),
        targetY: Math.round(roomY + roomH * 0.52),
        fov: 40,
        height: "eye",
        motion: "Handheld Dutch Drift",
      },
      {
        id: "cam-c",
        name: "Cam C · Intimate Close-Up",
        focalLength: 85,
        lensName: "85mm T1.4 Portrait Telephoto",
        x: Math.round(roomX + roomW * 0.3),
        y: Math.round(roomY + roomH * 0.7),
        targetX: Math.round(roomX + roomW * 0.64),
        targetY: Math.round(roomY + roomH * 0.48),
        fov: 24,
        height: "low",
        motion: "Static Master Lock-Off",
      },
    ],
    props: [
      {
        id: "prop-1",
        name: "Primary Console / Table",
        x: Math.round(roomX + roomW * 0.45),
        y: Math.round(roomY + roomH * 0.45),
        w: Math.round(roomW * 0.12),
        h: Math.round(roomH * 0.18),
        label: "CENTER CONSOLE",
      },
      {
        id: "prop-2",
        name: "Practical Barrier Rig",
        x: Math.round(roomX + roomW * 0.08),
        y: Math.round(roomY + roomH * 0.25),
        w: Math.round(roomW * 0.08),
        h: Math.round(roomH * 0.5),
        label: "REINFORCED RIG",
      },
    ],
    lights: [
      {
        id: "light-1",
        name: "Key Light (Rembrandt)",
        x: Math.round(roomX + roomW * 0.3),
        y: Math.round(roomY + roomH * 0.2),
        type: "key",
        color: "#38bdf8",
        intensity: 90,
      },
      {
        id: "light-2",
        name: "Soft Fill Panel",
        x: Math.round(roomX + roomW * 0.72),
        y: Math.round(roomY + roomH * 0.68),
        type: "fill",
        color: "#e2e8f0",
        intensity: 45,
      },
      {
        id: "light-3",
        name: "Amber Ingress Practical",
        x: Math.round(roomX + roomW * 0.88),
        y: Math.round(roomY + roomH * 0.85),
        type: "practical",
        color: "#f59e0b",
        intensity: 75,
      },
    ],
  };
}

/* -------------------------------------------------------------------------
   Component Implementation
   ------------------------------------------------------------------------- */

export function FloorPlanView({
  sceneTitle,
  characters = [],
  primaryLocation,
  screenplayText = "",
  directorStyle = "David Fincher / Neo-Noir Precision",
  className,
  initialMapUrl,
  initialMapName,
  initialMapConfig,
  onMapChange,
  onMapConfigChange,
  onSendToVideo,
}: FloorPlanViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = React.useState({ width: 960, height: 360 });
  const [selectedCam, setSelectedCam] = React.useState<string>("cam-a");
  const [selectedEntity, setSelectedEntity] = React.useState<{
    type: "cam" | "char" | "light" | "prop" | "target";
    id: string;
  } | null>({ type: "cam", id: "cam-a" });

  const [show180Axis, setShow180Axis] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"viewfinder" | "inspector" | "precedents" | "shotlist">("viewfinder");

  // Building Top-Level Map / Architectural Blueprint Background State
  const [mapUrl, setMapUrl] = React.useState<string | null>(
    initialMapUrl || null
  );
  const [mapName, setMapName] = React.useState<string>(
    initialMapName || "No Map Loaded"
  );
  const [mapOpacity, setMapOpacity] = React.useState<number>(
    initialMapConfig?.opacity ?? 0.55
  );
  const [mapScale, setMapScale] = React.useState<number>(
    initialMapConfig?.scale ?? 1.0
  );
  const [mapOffsetX, setMapOffsetX] = React.useState<number>(
    initialMapConfig?.offsetX ?? 0
  );
  const [mapOffsetY, setMapOffsetY] = React.useState<number>(
    initialMapConfig?.offsetY ?? 0
  );
  const [mapRotation, setMapRotation] = React.useState<number>(
    initialMapConfig?.rotation ?? 0
  );
  const [mapInvert, setMapInvert] = React.useState<boolean>(
    initialMapConfig?.invert ?? false
  );
  const [showGrid, setShowGrid] = React.useState<boolean>(
    initialMapConfig?.showGrid ?? true
  );
  const [showMapControls, setShowMapControls] = React.useState<boolean>(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = React.useState<boolean>(false);

  // Sync if initialMapUrl or initialMapConfig updates externally
  React.useEffect(() => {
    if (initialMapUrl !== undefined) {
      setMapUrl(initialMapUrl);
      if (initialMapName) setMapName(initialMapName);
    }
  }, [initialMapUrl, initialMapName]);

  React.useEffect(() => {
    if (initialMapConfig) {
      if (initialMapConfig.opacity !== undefined) setMapOpacity(initialMapConfig.opacity);
      if (initialMapConfig.scale !== undefined) setMapScale(initialMapConfig.scale);
      if (initialMapConfig.offsetX !== undefined) setMapOffsetX(initialMapConfig.offsetX);
      if (initialMapConfig.offsetY !== undefined) setMapOffsetY(initialMapConfig.offsetY);
      if (initialMapConfig.rotation !== undefined) setMapRotation(initialMapConfig.rotation);
      if (initialMapConfig.invert !== undefined) setMapInvert(initialMapConfig.invert);
      if (initialMapConfig.showGrid !== undefined) setShowGrid(initialMapConfig.showGrid);
    }
  }, [initialMapConfig]);

  // Notify parent of control updates
  const updateMapControls = React.useCallback(
    (updates: Partial<FloorPlanMapConfig>) => {
      onMapConfigChange?.({
        opacity: updates.opacity !== undefined ? updates.opacity : mapOpacity,
        scale: updates.scale !== undefined ? updates.scale : mapScale,
        offsetX: updates.offsetX !== undefined ? updates.offsetX : mapOffsetX,
        offsetY: updates.offsetY !== undefined ? updates.offsetY : mapOffsetY,
        rotation: updates.rotation !== undefined ? updates.rotation : mapRotation,
        invert: updates.invert !== undefined ? updates.invert : mapInvert,
        showGrid: updates.showGrid !== undefined ? updates.showGrid : showGrid,
      });
    },
    [mapOpacity, mapScale, mapOffsetX, mapOffsetY, mapRotation, mapInvert, showGrid, onMapConfigChange]
  );

  // Autonomous Shot List State
  const [shotlistData, setShotlistData] = React.useState<ShotlistResponse | null>(null);
  const [isGeneratingShotlist, setIsGeneratingShotlist] = React.useState(false);

  const handleGenerateShotlist = async () => {
    setIsGeneratingShotlist(true);
    try {
      const res = await fetch("/api/shotlist/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene_text: screenplayText.trim() || `${sceneTitle}\n\nMarcus and Elena confront each other in the locked vault.`,
          scene_title: sceneTitle,
          director_style: directorStyle,
          characters: characters.map((c) => c.name),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShotlistData(data);
        notifyIfFallback(data, "Autonomous Shot List");
        toast.add({
          title: "AI Shot List Generated",
          description: `Architected ${data.shots?.length || 4} camera setups grounded in ${directorStyle}.`,
          type: "success",
        });
      }
    } catch (err) {
      toast.add({
        title: "Shot List Generation Failed",
        description: err instanceof Error ? err.message : "Could not reach the generation backend.",
        type: "error",
      });
    } finally {
      setIsGeneratingShotlist(false);
    }
  };

  const handleStageShot = (shot: ShotItem) => {
    const focal = shot.lens.includes("18mm")
      ? 18
      : shot.lens.includes("24mm")
      ? 24
      : shot.lens.includes("35mm")
      ? 35
      : shot.lens.includes("50mm")
      ? 50
      : 85;

    setStageCameras((prev) =>
      prev.map((cam, idx) => {
        if (idx === 0 || cam.id === selectedCam) {
          return {
            ...cam,
            lensName: shot.lens,
            focalLength: focal,
            fov: focalToFov(focal),
            motion: shot.camera_movement,
            name: `Shot ${shot.shot_number} · ${shot.shot_type}`,
          };
        }
        return cam;
      })
    );

    toast.add({
      title: `Shot ${shot.shot_number} Staged on Floor Plan`,
      description: `Configured active camera with ${shot.lens} · ${shot.camera_movement}.`,
      type: "success",
    });
  };

  // AI Location Scout State
  const [isScouting, setIsScouting] = React.useState(false);
  const [scoutedData, setScoutedData] = React.useState<LocationScoutData | null>(null);
  const [scoutError, setScoutError] = React.useState<string | null>(null);

  // Viewfinder Shot Image Preview state
  const [shotImageUrl, setShotImageUrl] = React.useState<string | null>(null);
  const [isRenderingShot, setIsRenderingShot] = React.useState(false);

  // Stage boundaries inside SVG
  const svgW = dimensions.width;
  const svgH = dimensions.height;
  const roomW = Math.min(svgW - 50, 880);
  const roomH = Math.min(svgH - 40, 300);
  const roomX = Math.round((svgW - roomW) / 2);
  const roomY = Math.round((svgH - roomH) / 2);

  // Synchronously initialize stage elements so activeCam is NEVER undefined
  const initialLayout = React.useMemo(() => {
    return getLayoutPreset("dialogue", characters, roomX, roomY, roomW, roomH);
  }, [characters, roomX, roomY, roomW, roomH]);

  const [stageChars, setStageChars] = React.useState<FloorPlanCharacter[]>(() => initialLayout.chars);
  const [stageCameras, setStageCameras] = React.useState<CameraSetup[]>(() => initialLayout.cameras);
  const [stageLights, setStageLights] = React.useState<PracticalLight[]>(() => initialLayout.lights);
  const [stageProps, setStageProps] = React.useState<StageProp[]>(() => initialLayout.props);

  // Dragging interaction state
  const dragRef = React.useRef<{
    active: boolean;
    type: "char" | "cam" | "target" | "light" | "prop" | "char_rot";
    id: string;
    offsetX: number;
    offsetY: number;
  }>({ active: false, type: "char", id: "", offsetX: 0, offsetY: 0 });

  // Reset to preset layout
  const resetToPreset = React.useCallback(
    (presetName: "dialogue" | "triangle" | "interrogation" | "walk" = "dialogue") => {
      const data = getLayoutPreset(presetName, characters, roomX, roomY, roomW, roomH);
      setStageChars(data.chars);
      setStageCameras(data.cameras);
      setStageLights(data.lights);
      setStageProps(data.props);
    },
    [characters, roomX, roomY, roomW, roomH]
  );

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.round(width), height: Math.max(340, Math.round(height)) });
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const getSvgPoint = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: Math.round(svgPt.x), y: Math.round(svgPt.y) };
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    type: "char" | "cam" | "target" | "light" | "prop" | "char_rot",
    id: string
  ) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getSvgPoint(e);

    let originX = p.x;
    let originY = p.y;

    if (type === "char" || type === "char_rot") {
      const c = stageChars.find((c) => c.id === id);
      if (c) {
        originX = c.x;
        originY = c.y;
      }
      setSelectedEntity({ type: "char", id });
    } else if (type === "cam") {
      const c = stageCameras.find((c) => c.id === id);
      if (c) {
        originX = c.x;
        originY = c.y;
      }
      setSelectedCam(id);
      setSelectedEntity({ type: "cam", id });
    } else if (type === "target") {
      const c = stageCameras.find((c) => c.id === id);
      if (c) {
        originX = c.targetX;
        originY = c.targetY;
      }
      setSelectedCam(id);
      setSelectedEntity({ type: "target", id });
    } else if (type === "light") {
      const l = stageLights.find((l) => l.id === id);
      if (l) {
        originX = l.x;
        originY = l.y;
      }
      setSelectedEntity({ type: "light", id });
    } else if (type === "prop") {
      const pr = stageProps.find((pr) => pr.id === id);
      if (pr) {
        originX = pr.x;
        originY = pr.y;
      }
      setSelectedEntity({ type: "prop", id });
    }

    dragRef.current = {
      active: true,
      type,
      id,
      offsetX: p.x - originX,
      offsetY: p.y - originY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const { type, id, offsetX, offsetY } = dragRef.current;
    const p = getSvgPoint(e);

    const targetX = p.x - offsetX;
    const targetY = p.y - offsetY;

    if (type === "char") {
      setStageChars((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                x: Math.max(roomX + 15, Math.min(roomX + roomW - 15, targetX)),
                y: Math.max(roomY + 15, Math.min(roomY + roomH - 15, targetY)),
              }
            : c
        )
      );
    } else if (type === "char_rot") {
      setStageChars((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const rad = Math.atan2(p.y - c.y, p.x - c.x);
          let deg = Math.round((rad * 180) / Math.PI);
          if (deg < 0) deg += 360;
          return { ...c, angle: deg };
        })
      );
    } else if (type === "cam") {
      setStageCameras((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const newX = Math.max(roomX - 30, Math.min(roomX + roomW + 30, targetX));
          const newY = Math.max(roomY - 30, Math.min(roomY + roomH + 30, targetY));
          return { ...c, x: newX, y: newY };
        })
      );
    } else if (type === "target") {
      setStageCameras((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const newTargetX = Math.max(roomX + 10, Math.min(roomX + roomW - 10, targetX));
          const newTargetY = Math.max(roomY + 10, Math.min(roomY + roomH - 10, targetY));
          return { ...c, targetX: newTargetX, targetY: newTargetY };
        })
      );
    } else if (type === "light") {
      setStageLights((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                x: Math.max(roomX + 10, Math.min(roomX + roomW - 10, targetX)),
                y: Math.max(roomY + 10, Math.min(roomY + roomH - 10, targetY)),
              }
            : l
        )
      );
    } else if (type === "prop") {
      setStageProps((prev) =>
        prev.map((pr) =>
          pr.id === id
            ? {
                ...pr,
                x: Math.max(roomX + 5, Math.min(roomX + roomW - pr.w - 5, targetX)),
                y: Math.max(roomY + 5, Math.min(roomY + roomH - pr.h - 5, targetY)),
              }
            : pr
        )
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Safe activeCam guaranteed never to be undefined
  const activeCam = stageCameras.find((c) => c.id === selectedCam) || stageCameras[0] || FALLBACK_CAM;

  // 180-Degree Action Axis Math
  const char0 = stageChars[0];
  const char1 = stageChars[1];

  const axisData = React.useMemo(() => {
    if (!char0 || !char1) return null;
    const dx = char1.x - char0.x;
    const dy = char1.y - char0.y;

    const getSide = (x: number, y: number) => {
      const val = dx * (y - char0.y) - dy * (x - char0.x);
      return val > 0 ? 1 : val < 0 ? -1 : 0;
    };

    const camA = stageCameras.find((c) => c.id === "cam-a") || stageCameras[0] || FALLBACK_CAM;
    const legalSide = camA ? getSide(camA.x, camA.y) : 1;

    const violations: Record<string, boolean> = {};
    stageCameras.forEach((cam) => {
      const side = getSide(cam.x, cam.y);
      violations[cam.id] = side !== 0 && legalSide !== 0 && side !== legalSide;
    });

    return {
      x1: char0.x,
      y1: char0.y,
      x2: char1.x,
      y2: char1.y,
      violations,
      hasViolations: Object.values(violations).some(Boolean),
    };
  }, [char0, char1, stageCameras]);

  const computeFrustum = React.useCallback((cam: CameraSetup) => {
    const angleRad = Math.atan2(cam.targetY - cam.y, cam.targetX - cam.x);
    const halfFovRad = ((cam.fov / 2) * Math.PI) / 180;

    const targetDist = Math.hypot(cam.targetX - cam.x, cam.targetY - cam.y);
    const reach = Math.max(targetDist + 80, 220);

    const a1 = angleRad - halfFovRad;
    const a2 = angleRad + halfFovRad;

    const x1 = cam.x + Math.cos(a1) * reach;
    const y1 = cam.y + Math.sin(a1) * reach;
    const x2 = cam.x + Math.cos(a2) * reach;
    const y2 = cam.y + Math.sin(a2) * reach;

    return {
      path: `M ${cam.x} ${cam.y} L ${x1} ${y1} A ${reach} ${reach} 0 0 1 ${x2} ${y2} Z`,
      reach,
      angleRad,
      halfFovRad,
    };
  }, []);

  const framedAnalysis = React.useMemo(() => {
    if (!activeCam) return { inFrameChars: [], shotType: "Master Shot", distanceFt: "12" };
    const { angleRad, halfFovRad, reach } = computeFrustum(activeCam);

    const inFrame: Array<{ char: FloorPlanCharacter; dist: number; relAngle: number; isFacing: boolean }> = [];

    stageChars.forEach((ch) => {
      const chAngle = Math.atan2(ch.y - activeCam.y, ch.x - activeCam.x);
      const dist = Math.hypot(ch.x - activeCam.x, ch.y - activeCam.y);

      let diff = chAngle - angleRad;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      if (Math.abs(diff) <= halfFovRad && dist <= reach) {
        const camToCharDeg = (chAngle * 180) / Math.PI;
        const facingDiff = Math.abs(((ch.angle - (camToCharDeg + 180) + 180) % 360) - 180);
        inFrame.push({
          char: ch,
          dist,
          relAngle: diff,
          isFacing: facingDiff < 90,
        });
      }
    });

    const targetDist = Math.hypot(activeCam.targetX - activeCam.x, activeCam.targetY - activeCam.y);
    const distanceFt = Math.max(3, Math.round((targetDist / 30) * 3.28 * 10) / 10);

    let shotType = "Master Establishing Wide";
    if (inFrame.length === 0) {
      shotType = "Environmental / Insert Frame";
    } else if (inFrame.length === 1) {
      if (activeCam.focalLength >= 85 || distanceFt < 7) {
        shotType = `Tight Single Close-Up · ${inFrame[0].char.name}`;
      } else if (activeCam.focalLength >= 50 || distanceFt < 14) {
        shotType = `Medium Single · ${inFrame[0].char.name}`;
      } else {
        shotType = `Wide Single · ${inFrame[0].char.name}`;
      }
    } else if (inFrame.length === 2) {
      const sorted = [...inFrame].sort((a, b) => a.dist - b.dist);
      if (sorted[1].dist - sorted[0].dist > 50) {
        shotType = `Over-The-Shoulder (OTS) past ${sorted[0].char.name} ➔ ${sorted[1].char.name}`;
      } else {
        shotType = `Medium Two-Shot · ${sorted[0].char.name} & ${sorted[1].char.name}`;
      }
    } else {
      shotType = `Ensemble Group Staging (${inFrame.length} subjects in frame)`;
    }

    return { inFrameChars: inFrame, shotType, distanceFt };
  }, [activeCam, stageChars, computeFrustum]);

  const buildLiveVideoPrompt = React.useCallback(() => {
    if (!activeCam) return "";
    const primaryChar = framedAnalysis.inFrameChars[0]?.char?.name || stageChars[0]?.name || "Lead Subject";
    const heightLabel =
      activeCam.height === "low"
        ? "dramatic low-angle hero perspective looking upward"
        : activeCam.height === "high"
        ? "high-angle downward looking vantage"
        : activeCam.height === "dutch"
        ? "12-degree canted Dutch angle creating claustrophobic tension"
        : "natural eye-level perspective";

    const lightNotes = stageLights
      .map((l) => `${l.name} (${l.type}) positioned stage-${l.x > svgW / 2 ? "right" : "left"}`)
      .join(", ");

    return `2.39:1 Anamorphic Scope, ${framedAnalysis.shotType}. Captured on ${activeCam.lensName} (${activeCam.fov}° FOV) with ${activeCam.motion} from ${framedAnalysis.distanceFt}ft. Camera height: ${heightLabel}. Staging: ${primaryChar} framed on ${framedAnalysis.inFrameChars[0]?.relAngle && framedAnalysis.inFrameChars[0].relAngle < 0 ? "screen-left" : "screen-right"}. Lighting: ${lightNotes}. Setting: ${primaryLocation || sceneTitle || "Atmospheric cinematic soundstage"}, photorealistic, 35mm film grain, Hollywood cinematic color grade, no text or watermarks.`;
  }, [activeCam, framedAnalysis, stageChars, stageLights, primaryLocation, sceneTitle, svgW]);

  const handleSendToVideoBridge = () => {
    if (!onSendToVideo || !activeCam) return;
    const promptNote = buildLiveVideoPrompt();
    onSendToVideo({
      camName: activeCam.name,
      lens: `${activeCam.focalLength}mm ${activeCam.lensName.split(" ").slice(1).join(" ")}`,
      motion: activeCam.motion,
      promptNote,
    });
    toast.add({
      title: "Staging Sent to Video Prompt",
      description: `${activeCam.name} (${activeCam.focalLength}mm) geometry & lighting cues transferred.`,
      type: "success",
    });
  };

  const handleGenerateShotFrame = async (customPrompt?: unknown) => {
    if (isRenderingShot) return;
    setIsRenderingShot(true);
    try {
      const prompt = typeof customPrompt === "string" ? customPrompt : buildLiveVideoPrompt();
      const res = await fetch("/api/media/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, aspect_ratio: "16:9" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image_url) {
          setShotImageUrl(data.image_url);
          toast.add({
            title: "Shot concept rendered",
            description: `Generated ${activeCam.name} framing with Imagen 3.`,
            type: "success",
          });
        }
      } else {
        toast.add({
          title: "Image generation failed",
          description: "Could not render shot visual. Using architectural simulation.",
          type: "error",
        });
      }
    } catch {
      toast.add({
        title: "Connection error",
        description: "Failed to reach media generation endpoint.",
        type: "error",
      });
    } finally {
      setIsRenderingShot(false);
    }
  };

  const handleRunLocationScout = async () => {
    if (isScouting) return;
    setIsScouting(true);
    setScoutError(null);
    try {
      const res = await fetch("/api/location/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene_description: primaryLocation
            ? `${sceneTitle || "Cinematic Confrontation"} — Primary Setting: ${primaryLocation}`
            : sceneTitle || "Cinematic Confrontation",
          characters: characters.map((c) => c.name),
          genre: "Cinematic Drama / Thriller",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScoutedData(data);
        notifyIfFallback(data, "Location Scout");

        if (data.camera_package) {
          setStageCameras((prev) =>
            prev.map((c, i) => {
              const packageStr =
                i === 0
                  ? data.camera_package.cam_a
                  : i === 1
                  ? data.camera_package.cam_b
                  : data.camera_package.cam_c;
              if (!packageStr) return c;

              const match = packageStr.match(/(\d+)\s*mm/i);
              const mm = match ? parseInt(match[1], 10) : c.focalLength;
              const fov = focalToFov(mm);

              return {
                ...c,
                focalLength: mm,
                lensName: packageStr,
                fov,
              };
            })
          );
        }

        toast.add({
          title: "AI Location Scout completed",
          description: "Hollywood historical comps and camera blocking package updated.",
          type: "success",
        });
      } else {
        const detail = await res.text().catch(() => "");
        setScoutError(detail || `Location scout failed (${res.status}).`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach scouting backend.";
      setScoutError(message);
    } finally {
      setIsScouting(false);
    }
  };

  return (
    <div className={`flex flex-col rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm ${className ?? ""}`}>
      {/* Top Header & Directorial Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-accent" />
            <SlateLabel>Director&apos;s 2D Floor Plan &amp; Spatial Blocking</SlateLabel>
            <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent text-[10px] font-mono">
              Interactive 3-Cam Engine
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">{sceneTitle || "Cinematic Scene"}</span>
            {primaryLocation && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded max-w-sm truncate"
                title={primaryLocation}
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{primaryLocation}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Staging Layout Presets */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border text-[11px]">
            <span className="text-muted-foreground px-1.5 font-mono text-[10px]">PRESETS:</span>
            <button
              onClick={() => resetToPreset("dialogue")}
              className="px-2 py-0.5 rounded hover:bg-secondary text-foreground text-[11px] font-medium transition-colors cursor-pointer"
              title="Classic 2-Shot Dialogue with complementary reverse OTS"
            >
              Dialogue OTS
            </button>
            <button
              onClick={() => resetToPreset("triangle")}
              className="px-2 py-0.5 rounded hover:bg-secondary text-foreground text-[11px] font-medium transition-colors cursor-pointer"
              title="3-Way Mexican Standoff with cross sightlines"
            >
              Triangle
            </button>
            <button
              onClick={() => resetToPreset("interrogation")}
              className="px-2 py-0.5 rounded hover:bg-secondary text-foreground text-[11px] font-medium transition-colors cursor-pointer"
              title="High tension interrogation across console"
            >
              Interrogation
            </button>
            <button
              onClick={() => resetToPreset("walk")}
              className="px-2 py-0.5 rounded hover:bg-secondary text-foreground text-[11px] font-medium transition-colors cursor-pointer"
              title="Walk & Talk corridor with tracking Steadicam"
            >
              Walk &amp; Talk
            </button>
          </div>

          {/* 180-Degree Action Axis Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShow180Axis(!show180Axis)}
            className={`h-7 text-xs gap-1 font-mono cursor-pointer ${
              show180Axis ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "text-muted-foreground"
            }`}
          >
            <ShieldAlert className="h-3 w-3" />
            <span>180° Axis</span>
          </Button>

          {/* Building Top-Level Map Background Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMapControls(!showMapControls)}
            className={`h-7 text-xs gap-1.5 font-mono cursor-pointer transition-all ${
              mapUrl ? "border-accent/50 bg-accent/15 text-accent shadow-xs" : "text-muted-foreground"
            }`}
          >
            <MapPin className="h-3 w-3" />
            <span>{mapUrl ? "Building Map (Active)" : "Add Building Map"}</span>
            {mapUrl && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono hidden sm:inline-block">
                {Math.round(mapOpacity * 100)}%
              </Badge>
            )}
          </Button>

          {/* AI Scout Button */}
          <Button
            size="sm"
            onClick={handleRunLocationScout}
            disabled={isScouting}
            className="text-xs h-7 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer"
          >
            {isScouting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            <span>{isScouting ? "Scouting..." : "AI Scout (Gemini 3.7)"}</span>
          </Button>
        </div>
      </div>

      {/* Building Top-Level Map Inspector & Alignment Controls Panel */}
      {showMapControls && (
        <div className="p-3.5 rounded-xl border border-accent/40 bg-[#0e1017] shadow-xl animate-in fade-in-50 duration-150 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" />
              <span className="text-xs font-bold text-foreground">
                2D Camera Blocking · Top-Level Building Map &amp; Blueprint Setup
              </span>
              {mapUrl && (
                <Badge variant="outline" className="text-[10px] font-mono border-accent/40 text-accent">
                  {mapName}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAssetPickerOpen(true)}
                className="h-7 text-xs gap-1.5 border-accent/50 text-accent hover:bg-accent/20 cursor-pointer"
              >
                <Upload className="h-3 w-3" />
                <span>Upload Map / Pick from Asset Hub</span>
              </Button>
              {mapUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMapUrl(null);
                    setMapName("None");
                    onMapChange?.(null, undefined);
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                >
                  Clear Background
                </Button>
              )}
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => setShowMapControls(false)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Map Source & Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1">
            {/* Map Source */}
            <div className="space-y-1.5 md:border-r border-border/60 md:pr-3">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                Map Source
              </span>
              <div className="space-y-2">
                {mapUrl ? (
                  <div className="p-2.5 rounded-md bg-secondary/50 border border-border/60 space-y-2">
                    <div className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-accent shrink-0" />
                      <span className="truncate">{mapName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setIsAssetPickerOpen(true)}
                        className="h-6 text-[10px] flex-1 cursor-pointer"
                      >
                        Change Map...
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          setMapUrl(null);
                          setMapName("No Map Loaded");
                          onMapChange?.(null, undefined);
                        }}
                        className="h-6 text-[10px] text-destructive hover:bg-destructive/20 px-2 cursor-pointer"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-md border border-dashed border-border/80 text-center space-y-2 bg-secondary/20">
                    <p className="text-[11px] text-muted-foreground">
                      No building map loaded. Upload an overhead blueprint or select one from your assets.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsAssetPickerOpen(true)}
                      className="h-7 text-xs w-full gap-1.5 text-accent border-accent/40 hover:bg-accent/10 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload / Select Map...</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Opacity & Zoom Scale Sliders */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Map Opacity</span>
                  <span className="font-mono text-accent">{Math.round(mapOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={mapOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMapOpacity(val);
                    updateMapControls({ opacity: val });
                  }}
                  className="w-full accent-accent h-1.5 bg-secondary rounded cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Zoom / Scale</span>
                  <span className="font-mono text-accent">{mapScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.05"
                  value={mapScale}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMapScale(val);
                    updateMapControls({ scale: val });
                  }}
                  className="w-full accent-accent h-1.5 bg-secondary rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Pan Offset X / Y Sliders */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Pan Offset X</span>
                  <span className="font-mono text-muted-foreground">{mapOffsetX}px</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  step="5"
                  value={mapOffsetX}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMapOffsetX(val);
                    updateMapControls({ offsetX: val });
                  }}
                  className="w-full accent-accent h-1.5 bg-secondary rounded cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Pan Offset Y</span>
                  <span className="font-mono text-muted-foreground">{mapOffsetY}px</span>
                </div>
                <input
                  type="range"
                  min="-150"
                  max="150"
                  step="5"
                  value={mapOffsetY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setMapOffsetY(val);
                    updateMapControls({ offsetY: val });
                  }}
                  className="w-full accent-accent h-1.5 bg-secondary rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Toggles & Actions */}
            <div className="space-y-2 flex flex-col justify-between">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nextRot = (mapRotation + 90) % 360;
                    setMapRotation(nextRot);
                    updateMapControls({ rotation: nextRot });
                  }}
                  className="h-7 text-xs gap-1 cursor-pointer"
                  title="Rotate Blueprint 90 degrees"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>Rotate ({mapRotation}°)</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nextInvert = !mapInvert;
                    setMapInvert(nextInvert);
                    updateMapControls({ invert: nextInvert });
                  }}
                  className={`h-7 text-xs gap-1 cursor-pointer ${
                    mapInvert ? "bg-accent/20 text-accent border-accent/40" : "text-muted-foreground"
                  }`}
                  title="Invert colors for dark-mode blueprint"
                >
                  <Sliders className="h-3 w-3" />
                  <span>Blueprint LUT</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const nextGrid = !showGrid;
                    setShowGrid(nextGrid);
                    updateMapControls({ showGrid: nextGrid });
                  }}
                  className={`h-7 text-xs gap-1 cursor-pointer ${
                    showGrid ? "text-foreground" : "text-muted-foreground line-through"
                  }`}
                >
                  <Grid className="h-3 w-3" />
                  <span>Grid {showGrid ? "On" : "Off"}</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMapScale(1.0);
                    setMapOffsetX(0);
                    setMapOffsetY(0);
                    setMapRotation(0);
                    updateMapControls({
                      scale: 1.0,
                      offsetX: 0,
                      offsetY: 0,
                      rotation: 0,
                    });
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Reset Alignment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scoutError && !isScouting && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center justify-between">
          <span>Location scout note: {scoutError}</span>
          <Button size="sm" variant="ghost" onClick={() => setScoutError(null)} className="h-5 text-[10px]">
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Director Workspace: Staging Canvas + Live Viewfinder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Interactive 2D Overhead Floor Plan Stage (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-2">
          {/* Canvas Toolbar Info */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-[10px] text-accent">
                <Move className="h-3 w-3" /> Drag characters, cameras, targets, &amp; lights
              </span>
              <span className="text-border">|</span>
              <span className="text-[10px] text-muted-foreground">Click entity to configure</span>
            </div>

            {/* 180° Rule Status Badge */}
            {axisData && show180Axis && (
              <div>
                {axisData.hasViolations ? (
                  <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-400 text-[10px] gap-1 font-mono">
                    <AlertTriangle className="h-3 w-3" /> 180° Axis Crossed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1 font-mono">
                    <CheckCircle2 className="h-3 w-3" /> 180° Eyelines Safe
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* SVG Canvas */}
          <div
            ref={containerRef}
            className="relative w-full h-[320px] sm:h-[360px] rounded-lg border border-border/80 bg-background/95 overflow-hidden select-none touch-none shadow-inner"
          >
            <svg
              ref={svgRef}
              className="w-full h-full block cursor-crosshair"
              viewBox={`0 0 ${svgW} ${svgH}`}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <defs>
                <pattern id="floor-grid-fine" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.25" />
                </pattern>
                <pattern id="floor-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
                  <rect width="100" height="100" fill="url(#floor-grid-fine)" />
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--border)" strokeWidth="1" opacity="0.45" />
                </pattern>

                <radialGradient id="active-frustum-grad" cx="0%" cy="0%" r="100%">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                  <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                </radialGradient>

                <radialGradient id="inactive-frustum-grad" cx="0%" cy="0%" r="100%">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.0" />
                </radialGradient>
              </defs>

              {showGrid && <rect width={svgW} height={svgH} fill="url(#floor-grid-major)" />}

              {/* Custom Top-Level Building Map / Architectural Blueprint Background */}
              {mapUrl && (
                <g
                  transform={`translate(${roomX + roomW / 2 + mapOffsetX}, ${roomY + roomH / 2 + mapOffsetY}) rotate(${mapRotation}) scale(${mapScale}) translate(${-(roomW / 2)}, ${-(roomH / 2)})`}
                  opacity={mapOpacity}
                  style={{
                    pointerEvents: "none",
                    filter: mapInvert
                      ? "invert(1) hue-rotate(180deg) brightness(0.9) contrast(1.25)"
                      : undefined,
                  }}
                >
                  <image
                    href={mapUrl}
                    x={0}
                    y={0}
                    width={roomW}
                    height={roomH}
                    preserveAspectRatio="xMidYMid meet"
                  />
                </g>
              )}

              <rect
                x={roomX}
                y={roomY}
                width={roomW}
                height={roomH}
                fill="none"
                stroke="var(--border)"
                strokeWidth="2.5"
                rx="6"
              />

              <text
                x={roomX + 12}
                y={roomY - 6}
                fill="var(--muted-foreground)"
                fontSize="9.5"
                fontFamily="ui-monospace, monospace"
                opacity="0.75"
              >
                {scoutedData?.location_aesthetic
                  ? `STAGE SETTING: ${scoutedData.location_aesthetic.slice(0, 48).toUpperCase()}`
                  : `${(sceneTitle || "SOUNDSTAGE 4").toUpperCase()} · STAGE PERIMETER`}
              </text>

              <line
                x1={roomX + roomW - 120}
                y1={roomY + roomH}
                x2={roomX + roomW - 20}
                y2={roomY + roomH}
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <text
                x={roomX + roomW - 70}
                y={roomY + roomH + 16}
                fill="var(--muted-foreground)"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
              >
                STAGE ACCESS / INGRESS
              </text>

              {show180Axis && axisData && (
                <g className="transition-all">
                  {(() => {
                    const dx = axisData.x2 - axisData.x1;
                    const dy = axisData.y2 - axisData.y1;
                    const len = Math.hypot(dx, dy) || 1;
                    const ux = dx / len;
                    const uy = dy / len;
                    const ex1 = axisData.x1 - ux * 400;
                    const ey1 = axisData.y1 - uy * 400;
                    const ex2 = axisData.x2 + ux * 400;
                    const ey2 = axisData.y2 + uy * 400;
                    const midX = (axisData.x1 + axisData.x2) / 2;
                    const midY = (axisData.y1 + axisData.y2) / 2;

                    return (
                      <>
                        <line
                          x1={ex1}
                          y1={ey1}
                          x2={ex2}
                          y2={ey2}
                          stroke="#eab308"
                          strokeWidth="1.5"
                          strokeDasharray="6 4"
                          opacity="0.65"
                        />
                        <rect
                          x={midX - 52}
                          y={midY - 9}
                          width="104"
                          height="18"
                          fill="var(--background)"
                          stroke="#eab308"
                          strokeWidth="1"
                          rx="3"
                          opacity="0.9"
                        />
                        <text
                          x={midX}
                          y={midY + 3.5}
                          fill="#eab308"
                          fontSize="8.5"
                          fontFamily="ui-monospace, monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                          letterSpacing="0.5"
                        >
                          180° ACTION AXIS
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Draggable Props */}
              {stageProps.map((pr) => {
                const isSelected = selectedEntity?.type === "prop" && selectedEntity.id === pr.id;
                return (
                  <g
                    key={pr.id}
                    className="cursor-move"
                    onPointerDown={(e) => handlePointerDown(e, "prop", pr.id)}
                  >
                    <rect
                      x={pr.x}
                      y={pr.y}
                      width={pr.w}
                      height={pr.h}
                      fill="var(--secondary)"
                      stroke={isSelected ? "var(--accent)" : "var(--border)"}
                      strokeWidth={isSelected ? "2" : "1.2"}
                      rx="3"
                    />
                    <text
                      x={pr.x + pr.w / 2}
                      y={pr.y + pr.h / 2 + 3.5}
                      fill="var(--muted-foreground)"
                      fontSize="9"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                      letterSpacing="0.5"
                    >
                      {pr.label}
                    </text>
                  </g>
                );
              })}

              {/* Draggable Practical Lights */}
              {stageLights.map((l) => {
                const isSelected = selectedEntity?.type === "light" && selectedEntity.id === l.id;
                return (
                  <g
                    key={l.id}
                    className="cursor-move"
                    onPointerDown={(e) => handlePointerDown(e, "light", l.id)}
                  >
                    <circle cx={l.x} cy={l.y} r={l.intensity * 0.35} fill={l.color} opacity="0.12" />
                    <circle
                      cx={l.x}
                      cy={l.y}
                      r="7"
                      fill={l.color}
                      stroke={isSelected ? "#ffffff" : "var(--background)"}
                      strokeWidth="2"
                    />
                    <text
                      x={l.x}
                      y={l.y + 18}
                      fill="var(--muted-foreground)"
                      fontSize="8.5"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                    >
                      {l.name}
                    </text>
                  </g>
                );
              })}

              {/* Camera Sightlines & FOV Frustums */}
              {stageCameras.map((cam) => {
                const isSelected = selectedCam === cam.id;
                const frustum = computeFrustum(cam);
                const isAxisViolator = axisData?.violations[cam.id];

                return (
                  <g key={`frustum-${cam.id}`}>
                    <path
                      d={frustum.path}
                      fill={
                        isAxisViolator
                          ? "rgba(239, 68, 68, 0.12)"
                          : isSelected
                          ? "url(#active-frustum-grad)"
                          : "url(#inactive-frustum-grad)"
                      }
                      stroke={
                        isAxisViolator
                          ? "rgba(239, 68, 68, 0.5)"
                          : isSelected
                          ? "var(--accent)"
                          : "var(--border)"
                      }
                      strokeWidth={isSelected ? "1.5" : "0.75"}
                      strokeDasharray={isSelected ? "none" : "3 3"}
                      opacity={isSelected ? 1 : 0.4}
                    />

                    <line
                      x1={cam.x}
                      y1={cam.y}
                      x2={cam.targetX}
                      y2={cam.targetY}
                      stroke={isAxisViolator ? "#ef4444" : isSelected ? "var(--accent)" : "var(--border)"}
                      strokeWidth={isSelected ? "1.5" : "1"}
                      strokeDasharray="4 4"
                      opacity={isSelected ? 0.9 : 0.3}
                    />

                    {isSelected && (
                      <g
                        className="cursor-move"
                        onPointerDown={(e) => handlePointerDown(e, "target", cam.id)}
                      >
                        <circle
                          cx={cam.targetX}
                          cy={cam.targetY}
                          r="10"
                          fill="transparent"
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                        <circle cx={cam.targetX} cy={cam.targetY} r="3" fill="var(--accent)" />
                        <line
                          x1={cam.targetX - 6}
                          y1={cam.targetY}
                          x2={cam.targetX + 6}
                          y2={cam.targetY}
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                        />
                        <line
                          x1={cam.targetX}
                          y1={cam.targetY - 6}
                          x2={cam.targetX}
                          y2={cam.targetY + 6}
                          stroke="var(--accent)"
                          strokeWidth="1.5"
                        />
                        <text
                          x={cam.targetX}
                          y={cam.targetY - 14}
                          fill="var(--accent)"
                          fontSize="8.5"
                          fontFamily="ui-monospace, monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          AIM
                        </text>
                      </g>
                    )}

                    <g
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown(e, "cam", cam.id)}
                      onClick={() => setSelectedCam(cam.id)}
                    >
                      <circle
                        cx={cam.x}
                        cy={cam.y}
                        r={isSelected ? 11 : 9}
                        fill={isAxisViolator ? "#ef4444" : isSelected ? "var(--accent)" : "var(--secondary)"}
                        stroke="var(--background)"
                        strokeWidth="2.5"
                        className="shadow-sm"
                      />
                      <Camera
                        x={cam.x - 5}
                        y={cam.y - 5}
                        width="10"
                        height="10"
                        className={isSelected || isAxisViolator ? "text-background" : "text-foreground"}
                      />
                      <text
                        x={cam.x}
                        y={cam.y + 22}
                        fill={isAxisViolator ? "#ef4444" : isSelected ? "var(--accent)" : "var(--foreground)"}
                        fontSize="9.5"
                        fontFamily="ui-monospace, monospace"
                        fontWeight={isSelected ? "bold" : "600"}
                        textAnchor="middle"
                      >
                        {cam.name.split("·")[0].trim()}
                      </text>
                      <text
                        x={cam.x}
                        y={cam.y + 32}
                        fill="var(--muted-foreground)"
                        fontSize="8"
                        fontFamily="ui-monospace, monospace"
                        textAnchor="middle"
                      >
                        {cam.focalLength}mm · {cam.fov}°
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Characters */}
              {stageChars.map((char) => {
                const rad = (char.angle * Math.PI) / 180;
                const rotHandleX = char.x + Math.cos(rad) * 26;
                const rotHandleY = char.y + Math.sin(rad) * 26;
                const isInActiveShot = framedAnalysis.inFrameChars.some((f) => f.char.id === char.id);

                return (
                  <g key={char.id}>
                    <line
                      x1={char.x}
                      y1={char.y}
                      x2={char.x + Math.cos(rad) * 44}
                      y2={char.y + Math.sin(rad) * 44}
                      stroke={char.color}
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity="0.9"
                    />

                    {isInActiveShot && (
                      <circle
                        cx={char.x}
                        cy={char.y}
                        r="18"
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        className="animate-pulse"
                      />
                    )}

                    <g
                      className="cursor-move"
                      onPointerDown={(e) => handlePointerDown(e, "char", char.id)}
                    >
                      <circle
                        cx={char.x}
                        cy={char.y}
                        r="13"
                        fill={char.color}
                        stroke="var(--background)"
                        strokeWidth="2.5"
                        className="shadow-md"
                      />
                      <text
                        x={char.x}
                        y={char.y + 4}
                        fill="#09090b"
                        fontSize="10"
                        fontWeight="bold"
                        fontFamily="ui-monospace, monospace"
                        textAnchor="middle"
                      >
                        {char.name[0]}
                      </text>
                    </g>

                    <g
                      className="group cursor-grab"
                      onPointerDown={(e) => handlePointerDown(e, "char_rot", char.id)}
                    >
                      {/* Generous hit target */}
                      <circle cx={rotHandleX} cy={rotHandleY} r="14" fill="transparent" />
                      <circle
                        cx={rotHandleX}
                        cy={rotHandleY}
                        r="4.5"
                        fill={char.color}
                        stroke="var(--background)"
                        strokeWidth="1.5"
                        className="transition-all duration-150 group-hover:stroke-[2.5px] pointer-events-none"
                      />
                      <title>{`Drag to rotate ${char.name}'s gaze (Current: ${char.angle}°)`}</title>
                    </g>

                    <text
                      x={char.x}
                      y={char.y + 24}
                      fill="var(--foreground)"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                    >
                      {char.name}
                    </text>
                    <text
                      x={char.x}
                      y={char.y + 34}
                      fill="var(--muted-foreground)"
                      fontSize="8"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                    >
                      {char.role}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Camera Selection Cards */}
          <div className="grid grid-cols-3 gap-2">
            {stageCameras.map((cam) => {
              const isSelected = selectedCam === cam.id;
              const isAxisViolator = axisData?.violations[cam.id];
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => {
                    setSelectedCam(cam.id);
                    setSelectedEntity({ type: "cam", id: cam.id });
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-all text-xs cursor-pointer ${
                    isSelected
                      ? "border-accent bg-accent/10 shadow-xs"
                      : "border-border bg-secondary/20 hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>
                      {cam.name.split("·")[0]}
                    </span>
                    {isAxisViolator ? (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                        180° Cross
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                        {cam.focalLength}mm
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-foreground truncate">{cam.lensName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{cam.motion}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Virtual Director's Viewfinder HUD & Inspector (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* Subtabs */}
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setActiveTab("viewfinder")}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeTab === "viewfinder"
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Viewfinder HUD
              </button>
              <button
                onClick={() => setActiveTab("inspector")}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeTab === "inspector"
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Rig Controls
              </button>
              <button
                onClick={() => setActiveTab("precedents")}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                  activeTab === "precedents"
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Comps ({scoutedData?.film_precedents?.length || 2})
              </button>
              <button
                onClick={() => setActiveTab("shotlist")}
                className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === "shotlist"
                    ? "bg-accent/15 text-accent font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Film className="h-3 w-3" />
                <span>Shot List ({shotlistData?.shots?.length || "Auto"})</span>
              </button>
            </div>
            <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground">
              2.39:1 Scope
            </Badge>
          </div>

          {activeTab === "viewfinder" && (
            <div className="space-y-3">
              {/* Virtual Viewfinder Monitor Frame */}
              <div className="relative w-full aspect-[2.39/1] rounded-lg border border-border/80 bg-black/90 overflow-hidden flex flex-col justify-between p-2 shadow-inner">
                {shotImageUrl ? (
                  <div className="absolute inset-0 z-0">
                    <img
                      src={shotImageUrl}
                      alt="Shot Viewfinder Concept"
                      className="w-full h-full object-cover opacity-85"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60" />
                  </div>
                ) : null}

                {/* Rule of Thirds Grid */}
                <div className="absolute inset-0 pointer-events-none z-10 opacity-20">
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 border border-white/40">
                    <div className="border-r border-b border-white/40" />
                    <div className="border-r border-b border-white/40" />
                    <div className="border-b border-white/40" />
                    <div className="border-r border-b border-white/40" />
                    <div className="border-r border-b border-white/40" />
                    <div className="border-b border-white/40" />
                  </div>
                </div>

                <div className="relative z-20 flex items-center justify-between text-[9px] font-mono text-amber-400/90 drop-shadow">
                  <span className="flex items-center gap-1">
                    {/* <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping inline-block" /> */}
                    {activeCam?.name ? activeCam.name.split("·")[0] : "Cam A"}
                  </span>
                  <span>{activeCam?.focalLength ?? 35}mm · T1.5 · {activeCam?.fov ?? 54}° FOV</span>
                </div>

                <div className="relative z-20 flex flex-col items-center justify-center my-auto pointer-events-none">
                  <Crosshair className="h-6 w-6 text-accent/40" />
                  <div className="bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono text-accent mt-1 border border-accent/30 text-center max-w-[200px] truncate">
                    {framedAnalysis.shotType}
                  </div>
                </div>

                <div className="relative z-20 flex items-center justify-between text-[9px] font-mono text-muted-foreground drop-shadow">
                  <span>DIST: {framedAnalysis.distanceFt} FT</span>
                  <span>HEIGHT: {activeCam?.height ? activeCam.height.toUpperCase() : "EYE"}</span>
                  <span>FPS: 24.00</span>
                </div>
              </div>

              {/* Viewfinder Action Strip */}
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateShotFrame}
                  disabled={isRenderingShot}
                  className="h-7 text-xs flex-1 gap-1.5 border-border bg-secondary/40 hover:bg-secondary text-foreground cursor-pointer"
                >
                  {isRenderingShot ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3 w-3 text-accent" />
                  )}
                  <span>{isRenderingShot ? "Rendering Shot..." : "Render Shot Frame (Imagen 3)"}</span>
                </Button>
                {shotImageUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShotImageUrl(null)}
                    className="h-7 text-[10px] text-muted-foreground px-2 cursor-pointer"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Real-Time Framing Diagnosis Summary */}
              <div className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-accent" />
                    Subject Eyelines &amp; Framing
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {framedAnalysis.inFrameChars.length} In-Frame
                  </span>
                </div>
                {framedAnalysis.inFrameChars.length > 0 ? (
                  <div className="space-y-1">
                    {framedAnalysis.inFrameChars.map((fc) => (
                      <div
                        key={fc.char.id}
                        className="flex items-center justify-between text-[11px] bg-background/60 p-1.5 rounded border border-border/50"
                      >
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: fc.char.color }} />
                          {fc.char.name}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {fc.relAngle < 0 ? "Screen-Left" : "Screen-Right"} · {fc.isFacing ? "Facing Lens" : "Profile"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    No characters directly inside the active lens frustum. Drag camera or focal target.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === "inspector" && (
            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                  <span>Focal Length &amp; Field of View</span>
                  <span className="font-mono text-[10px] text-accent">{activeCam?.fov ?? 54}° FOV</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {LENS_PRESETS.map((lp) => (
                    <button
                      key={lp.mm}
                      type="button"
                      onClick={() => {
                        setStageCameras((prev) =>
                          prev.map((c) =>
                            c.id === selectedCam
                              ? { ...c, focalLength: lp.mm, lensName: lp.label, fov: lp.fov }
                              : c
                          )
                        );
                      }}
                      className={`p-1.5 rounded border text-center transition-colors text-[11px] font-mono cursor-pointer ${
                        activeCam?.focalLength === lp.mm
                          ? "border-accent bg-accent/15 text-accent font-bold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lp.mm}mm
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Camera Height &amp; Pitch</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {HEIGHT_PRESETS.map((hp) => (
                    <button
                      key={hp.id}
                      type="button"
                      onClick={() => {
                        setStageCameras((prev) =>
                          prev.map((c) => (c.id === selectedCam ? { ...c, height: hp.id } : c))
                        );
                      }}
                      className={`p-1.5 rounded border text-left text-[10px] transition-colors cursor-pointer ${
                        activeCam?.height === hp.id
                          ? "border-accent bg-accent/15 text-accent font-bold"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="font-semibold">{hp.label}</div>
                      <div className="text-[9px] opacity-75 truncate">{hp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Movement Preset</label>
                <select
                  value={activeCam?.motion || "Slow Creeping Dolly In"}
                  onChange={(e) => {
                    const newMotion = e.target.value;
                    setStageCameras((prev) =>
                      prev.map((c) => (c.id === selectedCam ? { ...c, motion: newMotion } : c))
                    );
                  }}
                  className="w-full bg-secondary/40 border border-border rounded px-2 py-1 text-xs text-foreground font-mono focus:outline-none focus:border-accent"
                >
                  {MOTION_PRESETS.map((mp) => (
                    <option key={mp} value={mp}>
                      {mp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Snap Aim to Character</label>
                <div className="flex gap-1.5 flex-wrap">
                  {stageChars.map((ch) => (
                    <Button
                      key={ch.id}
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setStageCameras((prev) =>
                          prev.map((c) =>
                            c.id === selectedCam ? { ...c, targetX: ch.x, targetY: ch.y } : c
                          )
                        );
                      }}
                      className="h-6 text-[10px] gap-1 px-2 font-mono cursor-pointer"
                    >
                      <Crosshair className="h-3 w-3" />
                      <span>{ch.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "precedents" && (
            <div className="space-y-2.5 text-xs">
              <div className="rounded border border-border/60 bg-secondary/20 p-2 text-[11px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground block mb-0.5">Gemini Hollywood Precedents</span>
                Historical masterworks with corresponding spatial blocking and lens setups for this dramatic dynamic.
              </div>

              {scoutedData?.film_precedents && scoutedData.film_precedents.length > 0 ? (
                scoutedData.film_precedents.map((comp, idx) => (
                  <div key={idx} className="rounded border border-border/60 bg-secondary/30 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11px]">{comp.film}</span>
                      <span className="font-mono text-[9px] text-muted-foreground">{comp.director}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{comp.scene_comparison}</p>
                    <div className="text-[9px] font-mono text-accent pt-1 border-t border-border/40">
                      Technique: {comp.lens_and_blocking_technique}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  <div className="rounded border border-border/60 bg-secondary/30 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11px]">Heat (1995)</span>
                      <span className="font-mono text-[9px] text-muted-foreground">Michael Mann</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Diner confrontation where two opposing forces sit across a narrow table with subtext masking lethal intent.
                    </p>
                    <div className="text-[9px] font-mono text-accent pt-1 border-t border-border/40">
                      Technique: 85mm telephoto compression, tight profile OTS, strict 180° rule.
                    </div>
                  </div>
                  <div className="rounded border border-border/60 bg-secondary/30 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground text-[11px]">Sicario (2015)</span>
                      <span className="font-mono text-[9px] text-muted-foreground">Denis Villeneuve</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Sub-level interrogation room standoff with stark overhead practical halogens.
                    </p>
                    <div className="text-[9px] font-mono text-accent pt-1 border-t border-border/40">
                      Technique: 24mm anamorphic wide master framing human vulnerability against reinforced concrete.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "shotlist" && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground">
                  Autonomous Camera Shot List
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateShotlist}
                  disabled={isGeneratingShotlist}
                  className="h-6 text-[10px] px-2 gap-1 border-accent/40 text-accent hover:bg-accent/10 cursor-pointer"
                >
                  {isGeneratingShotlist ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  <span>{isGeneratingShotlist ? "Architecting..." : "Generate AI Shot List"}</span>
                </Button>
              </div>

              {shotlistData && (
                <div className="rounded border border-border/70 bg-secondary/30 p-2 text-[10px] font-mono space-y-0.5">
                  <div className="text-foreground font-semibold">{shotlistData.visual_rhythm}</div>
                  <div className="text-muted-foreground">{shotlistData.aspect_ratio} • {shotlistData.color_temperature}</div>
                </div>
              )}

              {isGeneratingShotlist && (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin text-accent" />
                  <span className="text-[11px] font-mono">Gemini DP is translating screenplay to shot list…</span>
                </div>
              )}

              {!isGeneratingShotlist && shotlistData?.shots && shotlistData.shots.length > 0 ? (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {shotlistData.shots.map((shot) => (
                    <div key={shot.shot_number} className="p-2.5 rounded-lg border border-border/80 bg-secondary/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] font-mono border-accent/40 text-accent">
                            Shot {shot.shot_number}
                          </Badge>
                          <span className="font-bold text-[11px] text-foreground">{shot.shot_type}</span>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          {shot.lens}
                        </span>
                      </div>

                      <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                        <span>Angle: {shot.angle}</span>
                        <span>{shot.estimated_duration_sec}s</span>
                      </div>

                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground block text-[10px]">Blocking:</span>
                        {shot.blocking_notes}
                      </div>

                      <div className="text-[10px] text-muted-foreground leading-snug">
                        <span className="font-semibold text-foreground block text-[10px]">Movement &amp; Lighting:</span>
                        {shot.camera_movement} • {shot.lighting_setup}
                      </div>

                      <div className="pt-1.5 border-t border-border/40 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStageShot(shot)}
                          className="px-2 py-1 rounded text-[10px] font-mono bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-colors cursor-pointer"
                        >
                          Stage on 2D Plan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShotImageUrl(null);
                            handleGenerateShotFrame(shot.imagen_prompt);
                            setActiveTab("viewfinder");
                          }}
                          className="px-2 py-1 rounded text-[10px] font-mono bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
                        >
                          Render Frame
                        </button>
                        {onSendToVideo && (
                          <button
                            type="button"
                            onClick={() =>
                              onSendToVideo({
                                camName: `Shot ${shot.shot_number} (${shot.shot_type})`,
                                lens: shot.lens,
                                motion: shot.camera_movement,
                                promptNote: shot.imagen_prompt,
                              })
                            }
                            className="px-2 py-1 rounded text-[10px] font-mono bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                          >
                            Send to Video ↗
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!isGeneratingShotlist && (!shotlistData || !shotlistData.shots || shotlistData.shots.length === 0) && (
                <div className="p-4 rounded border border-dashed border-border/80 text-center space-y-2">
                  <Film className="h-6 w-6 text-muted-foreground mx-auto" />
                  <p className="text-[11px] text-muted-foreground">
                    Click &ldquo;Generate AI Shot List&rdquo; to translate this scene&apos;s screenplay text into 4-6 camera angles, lenses, and blocking notes.
                  </p>
                  <Button
                    size="sm"
                    onClick={handleGenerateShotlist}
                    className="text-xs gap-1.5 bg-accent text-accent-foreground cursor-pointer"
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate Scene Shot List
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Master Send to Video Button */}
          <div className="pt-1">
            <Button
              size="sm"
              onClick={handleSendToVideoBridge}
              className="w-full h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs gap-1.5 shadow-sm cursor-pointer"
            >
              <Film className="h-3.5 w-3.5" />
              <span>Send Staging to Video Prompt ↗</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Director's Staging Prompt Preview Pill */}
      <div className="rounded-lg border border-border bg-secondary/30 p-2.5 text-xs space-y-1 font-mono text-muted-foreground">
        <div className="flex items-center justify-between text-[10px] text-foreground font-semibold">
          <span className="flex items-center gap-1.5">
            <Film className="h-3 w-3 text-accent" />
            Active Staging Prompt Specification:
          </span>
          <span className="text-accent font-mono text-[9px]">{activeCam?.name || "Cam A"}</span>
        </div>
        <p className="text-[11px] leading-relaxed line-clamp-2 text-foreground/90 font-sans">
          {buildLiveVideoPrompt()}
        </p>
      </div>

      {/* Asset Picker Modal for Custom Maps & Blueprints */}
      <AssetPickerModal
        open={isAssetPickerOpen}
        onOpenChange={setIsAssetPickerOpen}
        title="Select Top-Level Building Map or Architectural Blueprint"
        description="Choose an architectural blueprint, top-level layout, or aerial plan to align your camera and actor blocking."
        acceptedCategories={["map"]}
        onSelectAsset={(asset) => {
          setMapUrl(asset.url);
          setMapName(asset.name);
          setShowMapControls(true);
          onMapChange?.(asset.url, asset.name);
        }}
      />
    </div>
  );
}
