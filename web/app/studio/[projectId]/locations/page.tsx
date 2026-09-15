"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectById, saveProject, type ProjectData } from "@/lib/project-store";
import { LocationBoard } from "@/components/cinema/location-board";
import { AuthGate } from "@/components/cinema/auth-gate";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Film } from "lucide-react";

function ProjectLocationsWorkspace() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.projectId as string) || "";

  const [project, setProject] = React.useState<ProjectData | null>(null);

  React.useEffect(() => {
    const p = getProjectById(projectId);
    setProject(p || null);
  }, [projectId]);

  if (!project) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Loading project location data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Mini top nav */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/studio/${projectId}`)}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Studio</span>
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-xs font-bold text-foreground">{project.title}</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/studio/${projectId}`)}
          className="text-xs gap-1.5"
        >
          <Film className="h-3.5 w-3.5" />
          <span>All Sequence Slates</span>
        </Button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <LocationBoard
          project={project}
          onUpdateProject={(upd) => {
            setProject(upd);
            saveProject(upd);
          }}
        />
      </main>
    </div>
  );
}

export default function ProjectLocationsPage() {
  return (
    <AuthGate>
      <ProjectLocationsWorkspace />
    </AuthGate>
  );
}
