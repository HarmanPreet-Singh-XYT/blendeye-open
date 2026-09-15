import type { NewProjectFormData } from "@/components/cinema/new-project-dialog";

/**
 * The guided demo preset — "The Vault Protocol".
 *
 * This is a *preset*, not seeded data: clicking "Load Demo" opens the normal
 * New Production wizard pre-filled with these values and runs the ordinary
 * generation + sharding pipeline into the signed-in account. Nothing is created
 * automatically, and there is no shared/global demo project row any more.
 *
 * It lives here rather than inline in the dashboard because both the dashboard
 * and the public landing/showcase pages offer the same entry point, and the two
 * copies had already started to drift when they were maintained separately.
 */
export const VAULT_PROTOCOL_PRESET: NewProjectFormData = {
  title: "The Vault Protocol",
  logline:
    "A three-person heist crew breaches a private bank's sub-basement vault. The demolitions expert believes their exit route is secure — she doesn't know the getaway driver has already been paid off to seal it.",
  genre: "Heist Thriller",
  directorStyle: "Michael Mann",
  coreSecret:
    "Kessler has been paid by a rival crew to seal the vault's exit corridor once Rae and Priya are inside, trapping them so the rival crew can claim the score. Rae does not know Kessler has betrayed them until the exit corridor is sealed.",
  primaryLocation: "Sub-basement vault, First Continental Bank",
  targetTerritories: ["US", "UK"],
  narrativeFormat: "short",
  targetRuntimeMinutes: 18,
  customCharacters: [
    {
      name: "Rae",
      archetype: "Veteran demolitions expert, meticulous, trusts her crew completely",
      role: "Lead Protagonist",
      speechStyle: "terse, technical, controlled",
      subtextRatio: "moderate",
      objective: "Breach the vault and get the crew out clean",
    },
    {
      name: "Kessler",
      archetype:
        "Getaway driver secretly bought out by a rival crew; needs the job to fail without anyone tracing it to him",
      role: "Strategic Foil-Antagonist",
      speechStyle: "calm, reassuring, overly agreeable",
      subtextRatio: "high",
      objective: "Seal the exit corridor without being detected",
    },
    {
      name: "Priya",
      archetype: "Bank security consultant feeding the crew real-time floor intel",
      role: "Inside Informant",
      speechStyle: "clipped, professional",
      subtextRatio: "moderate",
      objective: "Keep the crew ahead of security response",
    },
  ],
};

/** Short marketing description of the preset, shared by the landing slate card. */
export const VAULT_PROTOCOL_SUMMARY = {
  title: "The Vault Protocol",
  genre: "Heist Thriller / Michael Mann",
  runtime: "Short — 18 Min",
  imageSrc: "/cinema/vault_heist.jpg",
  characters: ["Rae", "Kessler", "Priya"],
  logline: VAULT_PROTOCOL_PRESET.logline as string,
  hook:
    "Scrub to the moment the exit corridor seals, then interrogate Rae in the Hot Seat — she still believes her crew is intact while Kessler is already planning the double-cross.",
  badge: "Guided Demo",
  badgeVariant: "border-accent/40 bg-accent/15 text-accent",
};
