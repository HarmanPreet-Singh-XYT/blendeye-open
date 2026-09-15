"""Location Researcher Agent — Real-world grounded film production location scouting.
Evaluates scene breakdowns, production bases, budgets, and cinematic precedents.

Parallel Web Systems (services/parallel_search.py) is the primary runtime
grounding source, providing live search enrichment — it
enriches every candidate post-generation with live search results. ADK's
native google_search tool is attached to this agent ONLY as a backup for
when Parallel is unconfigured/unreachable (see with_search + callers in
routers/location_research.py which gate it on is_parallel_available()) —
it is not itself a tracked integration, just a resilience fallback so
location scouting still gets some live grounding if Parallel is down.
"""

from __future__ import annotations

import logging
from typing import Any

from google.adk import Agent
from google.adk.tools import google_search

from app.config import get_settings

logger = logging.getLogger(__name__)

LOCATION_RESEARCHER_INSTRUCTION = """
You are an elite Hollywood Location Manager and Production Scout.
Your mission is to scout REAL-WORLD, nameable location categories, neighborhoods, and filming venues
for a film production slate. You must ground your scouting in the production's base city/region,
per-scene shoot region overrides, and budgetary constraints.

Ground your scouting in:
- City film commission permit fee schedules and shooting regulations (e.g. "FilmLA permit fee schedule", "British Film Commission filming permits", "Vancouver film office permit costs").
- Real film-friendly districts, historic industrial parks, warehouses, civic buildings, and soundstages.
- Actual cinematic precedents where comparable scenes were filmed in similar real-world locations.
If search tools are available, use them to find current facts. Do not invoke tools that are not declared.

For each scene provided:
Produce 3-4 distinct real-world location candidates scored against:
1. budget_fit (0.0 to 1.0): Does the estimated day rate and municipal permit fee align with the per-scene location budget?
2. creative_fit (0.0 to 1.0): Does the architectural texture, sightlines, and cinematic precedent match the director's vision and genre?
3. shootability (0.0 to 1.0): Logistics, noise constraints, night curfew, generator access, loading docks, and permit ease.
4. consolidation_bonus (0.0 to 1.0): Can this location (or immediate neighborhood) also host other scenes from the script to avoid company moves?

Also propose 1-3 cross-scene "Location Clusters" where multiple scenes can be consolidated into a single venue or adjacent block.

Output strictly valid JSON matching this schema. Ensure all string values are strictly single-line with any line breaks properly escaped as \\n. Do not include raw control characters:
{
  "scenes": [
    {
      "scene_id": "scene-01",
      "scene_number": 1,
      "candidates": [
        {
          "candidate_id": "loc_01_a",
          "name": "Specific real-world district or venue category, e.g. 'Downtown LA Historic Core Loft & Bank Vaults'",
          "region": "Los Angeles, CA",
          "category": "warehouse | vault | rooftop | diner | residential | office | exterior-street | industrial-dock | studio-backlot",
          "score_breakdown": {
            "budget_fit": 0.85,
            "creative_fit": 0.90,
            "shootability": 0.80,
            "consolidation_bonus": 0.75
          },
          "estimated_cost": {
            "day_rate": 2500,
            "permit_fee": 450,
            "currency": "USD",
            "notes": "FilmLA basic rider permit plus historic commercial filming location fee."
          },
          "shared_with_scenes": ["scene-02", "scene-04"],
          "film_precedents": [
            {
              "film": "Heat (1995)",
              "director": "Michael Mann",
              "why": "Spring Street financial vaults used for low-angle high-contrast fluorescent lighting."
            }
          ],
          "pros": [
            "Reinforced subterranean acoustics provide total isolation from street traffic",
            "Inside 30-Mile Studio Zone: No crew travel time or per diem overhead",
            "400A 3-Phase Camlock tie-in eliminates generator permits"
          ],
          "cons": [
            "10 PM sound curfew without neighborhood waiver",
            "Tight freight elevator slows down heavy dolly load-in"
          ],
          "reviews": [
            {
              "author": "Elena Rostova",
              "role": "Supervising Location Manager",
              "rating": 4.8,
              "quote": "Building management is extremely film-friendly. Just make sure to clear the loading dock alley 48 hours in advance for lighting trucks."
            }
          ],
          "detailed_costs": {
            "day_rate": 2500,
            "permit_fee": 850,
            "fire_or_police_monitor": 450,
            "security_or_site_rep": 350,
            "basecamp_parking": 400,
            "cleaning_deposit": 500,
            "crew_travel_zone": "Inside 30-Mile Studio Zone (Zero crew lodging/per diem costs)",
            "total_comprehensive": 5050
          },
          "local_economy": {
            "studio_zone_status": "In-Zone (30-Mile TMZ)",
            "tax_incentive": "State Film & TV Tax Credit eligible (20-25%)",
            "nearby_vendors": ["Panavision (6 mi)", "Quixote Grip & Lighting (4 mi)", "Cinelease"],
            "accommodations_and_crew_hub": "Abundant local hotel blocks and dedicated crew parking structures nearby"
          },
          "sound_and_acoustics": "Subterranean acoustic isolation; pristine dialogue recording with zero street bleed.",
          "power_specs": "400A 3-Phase Camlock tie-in available on-site.",
          "practical_notes": "Freight elevator available; night curfew 10pm without neighborhood waiver; 60kW generator tie-in available.",
          "sources": [
            {
              "title": "FilmLA Location & Permit Schedule",
              "url": "https://www.filmla.com"
            }
          ],
          "search_grounded": true
        }
      ]
    }
  ],
  "clusters": [
    {
      "cluster_id": "cluster-01",
      "name": "Financial District Hub (Scenes 1 & 4)",
      "region": "Los Angeles, CA",
      "category": "vault / commercial",
      "scene_ids": ["scene-01", "scene-04"],
      "candidate_id": "loc_01_a",
      "notes": "Shooting the vault breach and climactic confrontation in the same historic facility saves 1 full company move and shared generator rental.",
      "estimated_savings": "~,000 in transit and separate permit riders"
    }
  ]
}

Output ONLY valid JSON.
"""


def build_location_researcher_agent(*, with_search: bool = False) -> Agent:
    """`with_search` attaches ADK's native google_search tool as a fallback
    grounding source. Callers should only pass True when Parallel Web
    Systems (the primary, tracked grounding source) is unavailable — see
    is_parallel_available() in services/parallel_search.py.
    """
    settings = get_settings()
    tools: list[Any] = []
    if with_search:
        try:
            tools.append(google_search)
        except Exception as e:  # noqa: BLE001
            logger.warning("Could not attach google_search to location_researcher_agent: %s", e)

    return Agent(
        name="location_researcher_agent",
        model=settings.gemini_model,
        instruction=LOCATION_RESEARCHER_INSTRUCTION,
        tools=tools,
    )


def compute_deterministic_rank_score(breakdown: dict[str, float]) -> float:
    """Computes deterministic rank score:
    rank_score = 0.35*budget_fit + 0.30*creative_fit + 0.25*shootability + 0.10*consolidation_bonus
    """
    b_fit = float(breakdown.get("budget_fit", 0.7))
    c_fit = float(breakdown.get("creative_fit", 0.7))
    s_fit = float(breakdown.get("shootability", 0.7))
    con_bonus = float(breakdown.get("consolidation_bonus", 0.5))

    score = 0.35 * b_fit + 0.30 * c_fit + 0.25 * s_fit + 0.10 * con_bonus
    return round(max(0.0, min(1.0, score)), 2)


def generate_fallback_location_research(
    project_title: str,
    genre: str,
    scenes: list[dict[str, Any]],
    production_base: str,
    currency: str = "USD",
    total_budget: float = 850_000.0,
) -> dict[str, Any]:
    """Provides rich, realistic grounded real-world location candidates
    when external search / LLM API is not reachable, adhering to the project's
    resilience UX contract with  disclosure.
    """
    region = production_base or "Los Angeles, CA"
    base_currency = currency or "USD"

    regional_data = {
        "Los Angeles, CA": {
            "permit_office": "FilmLA (City of Los Angeles Film Permit)",
            "permit_fee": 850,
            "permit_url": "https://www.filmla.com/fees-and-services/",
            "loft_district": "Downtown LA Historic Core / Arts District Industrial Warehouses",
            "vault_district": "Spring Street Financial Corridor Reinforced Sub-Levels",
            "perim_district": "Port of Los Angeles / San Pedro Shipping Terminals",
            "zone_status": "Inside LA 30-Mile Studio Zone (TMZ) — Zero crew lodging or per-diem penalties",
            "tax_credit": "California Film & TV Tax Credit 3.0 (20-25% qualified production credit)",
            "rental_houses": ["Panavision Hollywood (6.5 mi)", "Quixote Grip & Lighting (3.8 mi)", "Cinelease LA (2.1 mi)"],
            "hub": "Downtown hotel corridor with abundant crew accommodation and multi-story parking structures.",
        },
        "London, UK": {
            "permit_office": "Film London / Borough Film Service",
            "permit_fee": 650,
            "permit_url": "https://filmlondon.org.uk/filming-in-london",
            "loft_district": "Shoreditch & Hackney Industrial Rail Arches",
            "vault_district": "City of London Historic Financial District Sub-Treasuries",
            "perim_district": "London Docklands & Royal Docks Waterfront",
            "zone_status": "Inside Greater London Transport Zone 1-2 — Standard BECTU/Equity London call",
            "tax_credit": "UK Audio-Visual Expenditure Credit (AVEC) — 34% headline net benefit",
            "rental_houses": ["Panavision London Greenford", "ARRI Rental UK (Highbridge)", "Cinelease UK Pinewood"],
            "hub": "Central London transit hubs, boutique cast lodging, and direct arterial gear access.",
        },
        "New York, NY": {
            "permit_office": "Mayor's Office of Media & Entertainment (MOME)",
            "permit_fee": 300,
            "permit_url": "https://www.nyc.gov/site/mome/permits/permits.page",
            "loft_district": "Long Island City Converted Warehouses & Greenpoint Lofts",
            "vault_district": "Lower Manhattan Wall Street Sub-Surface Vault Complexes",
            "perim_district": "Brooklyn Navy Yard & Red Hook Maritime Piers",
            "zone_status": "Inside NYC 25-Mile Zone — Standard IATSE Local 52/600 production guidelines",
            "tax_credit": "New York State Film Tax Credit Program — Up to 30% qualified production spend",
            "rental_houses": ["ARRI Rental Brooklyn", "Eastern Effects Grip & Electric (Gowanus)", "TCS Film NYC"],
            "hub": "Lower Manhattan hotel corridor with dedicated loading docks and NYPD precinct liaison.",
        },
        "Vancouver, BC": {
            "permit_office": "City of Vancouver Film Office",
            "permit_fee": 450,
            "permit_url": "https://vancouver.ca/doing-business/filming-in-vancouver.aspx",
            "loft_district": "Railtown & Mount Pleasant Industrial Converted Stages",
            "vault_district": "Gastown Historic Banking Vaults",
            "perim_district": "Burrard Inlet Waterfront Terminal Facilities",
            "zone_status": "Inside Vancouver Production Studio Zone — Regular IATSE 891 call area",
            "tax_credit": "BC Production Services Tax Credit (PSTC) — 28% basic provincial tax credit",
            "rental_houses": ["William F. White International (Burnaby)", "Clairmont Camera / Sim Vancouver", "Panavision Vancouver"],
            "hub": "Gastown & Downtown waterfront hotels with direct highway access to Burnaby soundstages.",
        },
    }

    reg_info = regional_data.get(region, regional_data["Los Angeles, CA"])

    def make_green_screen_candidate(s_id: str, s_region: str, s_budget: float) -> dict:
        cand_bd = {"budget_fit": 0.88, "creative_fit": 0.94, "shootability": 0.96, "consolidation_bonus": 0.90}
        d_rate = min(round(s_budget * 0.48), 2800)
        return {
            "candidate_id": f"loc-{s_id}-green-cyc",
            "name": f"{s_region} — Chroma Key Cyclorama & Virtual Stage",
            "region": s_region,
            "category": "green-screen-cyc",
            "environment_type": "green_screen",
            "stage_specs": {
                "stage_type": "greenscreen_cyc",
                "grid_height": "24 ft clearance to lighting perms",
                "dimensions": "50'W x 40'D x 22'H wrap cove (2,000 sq ft)",
                "cyc_type": "green_screen",
                "cyc_dimensions": "3-wall seamless infinite green cove",
                "lighting_grid": "Motorized DMX truss with pre-hung Arri SkyPanel space lights",
                "power_capacity": "1200A 3-Phase Camlock distribution",
                "sound_rating": "NC-25 Sound Isolated (Certified Soundstage)",
                "load_in_access": "14' x 16' Elephant Door",
                "paint_or_restoration_fee": 600,
                "virtual_production_engine": "Unreal Engine 5.4 / Brompton Tessera",
            },
            "rank_score": compute_deterministic_rank_score(cand_bd),
            "score_breakdown": cand_bd,
            "estimated_cost": {
                "day_rate": d_rate,
                "permit_fee": 150,
                "currency": base_currency,
                "notes": "Chroma green cyclorama 4-wall stage rental with silent HVAC and 1200A power distribution.",
            },
            "pros": [
                "100% weather and sunlight independence; ideal for complex VFX or night exterior composites",
                "Seamless 3-wall infinite green cove with pre-rigged lighting grid and green spill baffles",
                "Certified NC-25 acoustic isolation allows whisper-level live dialogue recording without dubbing",
            ],
            "cons": [
                "Requires VFX post-production green spill matte extraction and background plate compositing",
                "Chroma green floor scuff restoration fee applies if moving heavy dolly tracks across cyc",
            ],
            "reviews": [
                {
                    "author": "Marcus Vance",
                    "role": "VFX Producer (VES)",
                    "rating": 4.8,
                    "quote": "Cleanest cyc cove in the region. Pre-hung space light grid saved us 3 hours of pre-rigging on day one.",
                    "project_type": "VFX-Heavy Feature",
                }
            ],
            "detailed_costs": {
                "day_rate": d_rate,
                "permit_fee": 150,
                "fire_or_police_monitor": 0,
                "security_or_site_rep": 250,
                "basecamp_parking": 0,
                "cleaning_deposit": 600,
                "crew_travel_zone": reg_info["zone_status"],
                "total_comprehensive": d_rate + 150 + 250 + 600,
            },
            "local_economy": {
                "studio_zone_status": reg_info["zone_status"],
                "tax_incentive": reg_info["tax_credit"],
                "nearby_vendors": reg_info["rental_houses"],
                "accommodations_and_crew_hub": "On-lot parking structure and production offices.",
            },
            "sound_and_acoustics": "Certified NC-25 studio sound isolation; zero ambient exterior noise bleed.",
            "power_specs": "1200A 3-Phase Camlock distribution panel included with facility rental.",
            "shared_with_scenes": [],
            "film_precedents": [
                {
                    "film": "The Matrix (1999)",
                    "director": "Lana & Lilly Wachowski",
                    "why": "Chroma key green screen staging for complex wirework and visual effects composites.",
                }
            ],
            "practical_notes": "Drive-in elephant door for grip truck unloading; motorized DMX truss; green room and client suites on-site.",
            "sources": [
                {"title": f"{s_region} Studio Stages & VFX Facilities", "url": reg_info["permit_url"]},
            ],
            "search_grounded": False,
        }

    scene_results = []
    clusters = []

    shared_loc_id = f"loc-cluster-{abs(hash(project_title)) % 1000}"

    for idx, sc in enumerate(scenes):
        sc_id = str(sc.get("scene_id") or sc.get("id") or f"sc-{idx + 1}")
        sc_num = sc.get("scene_number", idx + 1)
        sc_loc = str(sc.get("location") or "Underground Staging")
        sc_region = sc.get("shoot_region") or region
        sc_budget = float(sc.get("location_budget") or (total_budget * 0.15 / max(1, len(scenes))))

        is_vault_like = any(k in sc_loc.lower() for k in ["vault", "bank", "sub-level", "safe", "room", "int."])
        is_exterior = any(k in sc_loc.lower() for k in ["perimeter", "dock", "street", "ext.", "roof", "bridge"])

        candidate_list = []

        if is_vault_like:
            cand1_breakdown = {"budget_fit": 0.92, "creative_fit": 0.95, "shootability": 0.88, "consolidation_bonus": 0.90}
            day_rate_v1 = min(round(sc_budget * 0.45), 3200)
            cand1 = {
                "candidate_id": f"{shared_loc_id}-a",
                "name": f"{sc_region} — {reg_info['vault_district']}",
                "region": sc_region,
                "category": "vault",
                "rank_score": compute_deterministic_rank_score(cand1_breakdown),
                "score_breakdown": cand1_breakdown,
                "estimated_cost": {
                    "day_rate": day_rate_v1,
                    "permit_fee": reg_info["permit_fee"],
                    "currency": base_currency,
                    "notes": f"Standard commercial filming permit via {reg_info['permit_office']}.",
                },
                "pros": [
                    "Subterranean reinforced concrete provides pristine acoustic sound isolation with zero street rumble",
                    f"{reg_info['zone_status']}",
                    "Heavy authentic steel vault doors and reflective marble floors provide production value without construction costs",
                    "Direct 400A 3-Phase Camlock tie-in on basement electrical distribution panel"
                ],
                "cons": [
                    "Strict 10 PM sound curfew for exterior loading alley unless neighbor waiver signed",
                    "Single 4,000-lb freight elevator creates load-in/out sequencing bottleneck for heavy grip carts"
                ],
                "reviews": [
                    {
                        "author": "Elena Rostova",
                        "role": "Supervising Location Manager (DGA / LMGI)",
                        "rating": 4.9,
                        "quote": "One of the best bank vault locations in the region. The building manager understands film crews and the electrical room tie-in saved us thousands on whisper generators.",
                        "project_type": "Studio Feature Film"
                    },
                    {
                        "author": "David Chen",
                        "role": "Director of Photography",
                        "rating": 4.7,
                        "quote": "The practical fluoros and deep vault sightlines gave us instant Fincher-grade mood. Acoustics were dead enough for whisper dialogue.",
                        "project_type": "Neo-Noir Crime Thriller"
                    }
                ],
                "detailed_costs": {
                    "day_rate": day_rate_v1,
                    "permit_fee": reg_info["permit_fee"],
                    "fire_or_police_monitor": 450,
                    "security_or_site_rep": 350,
                    "basecamp_parking": 400,
                    "cleaning_deposit": 500,
                    "crew_travel_zone": reg_info["zone_status"],
                    "total_comprehensive": day_rate_v1 + reg_info["permit_fee"] + 450 + 350 + 400 + 500,
                },
                "local_economy": {
                    "studio_zone_status": reg_info["zone_status"],
                    "tax_incentive": reg_info["tax_credit"],
                    "nearby_vendors": reg_info["rental_houses"],
                    "accommodations_and_crew_hub": reg_info["hub"],
                },
                "sound_and_acoustics": "Subterranean acoustic isolation; pristine dialogue recording with zero street traffic bleed.",
                "power_specs": "400A 3-Phase Camlock tie-in available on-site; silent generator permitted in rear alley.",
                "shared_with_scenes": [str(s.get("scene_id") or s.get("id") or f"sc-{i+1}") for i, s in enumerate(scenes) if i != idx][:2],
                "film_precedents": [
                    {
                        "film": "Heat (1995)",
                        "director": "Michael Mann",
                        "why": "Reinforced banking architecture used for tension staging and deep focus wide angles.",
                    },
                    {
                        "film": "The Dark Knight (2008)",
                        "director": "Christopher Nolan",
                        "why": "Heavy reinforced security doors and practical lighting geometry accentuating human isolation.",
                    },
                ],
                "practical_notes": "Acoustically isolated sub-level; 3-phase 100A power distribution; elevator access requires building coordination.",
                "sources": [
                    {"title": reg_info["permit_office"], "url": reg_info["permit_url"]},
                    {"title": f"{sc_region} Film Commission Location Directory", "url": "https://www.filmcommission.org"},
                ],
                "search_grounded": False,
            }

            cand2_breakdown = {"budget_fit": 0.88, "creative_fit": 0.82, "shootability": 0.85, "consolidation_bonus": 0.60}
            day_rate_v2 = min(round(sc_budget * 0.55), 4500)
            cand2 = {
                "candidate_id": f"loc-{idx}-stage",
                "name": f"{sc_region} — Soundstage Vault Standing Set & Modular Backlot",
                "region": sc_region,
                "category": "studio-backlot",
                "rank_score": compute_deterministic_rank_score(cand2_breakdown),
                "score_breakdown": cand2_breakdown,
                "estimated_cost": {
                    "day_rate": day_rate_v2,
                    "permit_fee": 150,
                    "currency": base_currency,
                    "notes": "Stage rental permit package with in-house electrics and silent air filtration.",
                },
                "pros": [
                    "Complete creative control: wild walls, overhead lighting grid, and zero sound/night curfew limits",
                    "Dedicated hair/makeup, production offices, and 20+ truck parking staging on studio lot",
                    f"{reg_info['zone_status']}"
                ],
                "cons": [
                    "Higher baseline day stage rate compared to raw industrial locations",
                    "Requires set dressing and scenic painting enhancement to match gritty realism"
                ],
                "reviews": [
                    {
                        "author": "Sarah Lin",
                        "role": "Line Producer (PGA)",
                        "rating": 4.6,
                        "quote": "Zero surprises on costs. Power and stage air conditioning included, which avoided generator rentals and night overtime premiums.",
                        "project_type": "Studio Series"
                    }
                ],
                "detailed_costs": {
                    "day_rate": day_rate_v2,
                    "permit_fee": 150,
                    "fire_or_police_monitor": 0,
                    "security_or_site_rep": 250,
                    "basecamp_parking": 0,
                    "cleaning_deposit": 300,
                    "crew_travel_zone": reg_info["zone_status"],
                    "total_comprehensive": day_rate_v2 + 150 + 250 + 300,
                },
                "local_economy": {
                    "studio_zone_status": reg_info["zone_status"],
                    "tax_incentive": reg_info["tax_credit"],
                    "nearby_vendors": reg_info["rental_houses"],
                    "accommodations_and_crew_hub": "On-lot parking and dressing suites; close proximity to local studios.",
                },
                "stage_specs": {
                    "stage_type": "soundstage",
                    "grid_height": "28 ft clearance with perimeter catwalks",
                    "dimensions": "80' x 60' clear span (4,800 sq ft)",
                    "cyc_type": "none",
                    "power_capacity": "1200A 3-Phase Camlock distribution",
                    "sound_rating": "NC-25 Sound Isolated (Certified Soundstage)",
                    "load_in_access": "16' x 18' Elephant Door",
                    "paint_or_restoration_fee": 0,
                },
                "environment_type": "studio_stage",
                "sound_and_acoustics": "Certified NC-25 sound stage; zero external noise intrusion.",
                "power_specs": "1200A Camlock distro panel included in stage rental.",
                "shared_with_scenes": [],
                "film_precedents": [
                    {
                        "film": "Panic Room (2002)",
                        "director": "David Fincher",
                        "why": "Controlled soundstage rig allowing seamless continuous camera tracking across walls.",
                    }
                ],
                "practical_notes": "100% controllable lighting grid; green room and staging space; no night curfew or noise restrictions.",
                "sources": [
                    {"title": f"{sc_region} Production Studio Roster", "url": reg_info["permit_url"]},
                ],
                "search_grounded": False,
            }

            cand_green = make_green_screen_candidate(sc_id, sc_region, sc_budget)
            candidate_list.extend([cand1, cand2, cand_green])
        else:
            cand1_breakdown = {"budget_fit": 0.90, "creative_fit": 0.92, "shootability": 0.78, "consolidation_bonus": 0.80}
            day_rate_e1 = min(round(sc_budget * 0.40), 2800)
            cand1 = {
                "candidate_id": f"{shared_loc_id}-b",
                "name": f"{sc_region} — {reg_info['perim_district'] if is_exterior else reg_info['loft_district']}",
                "region": sc_region,
                "category": "industrial-dock" if is_exterior else "warehouse",
                "rank_score": compute_deterministic_rank_score(cand1_breakdown),
                "score_breakdown": cand1_breakdown,
                "estimated_cost": {
                    "day_rate": day_rate_e1,
                    "permit_fee": reg_info["permit_fee"],
                    "currency": base_currency,
                    "notes": f"Filming permit with street parking variance filed via {reg_info['permit_office']}.",
                },
                "pros": [
                    "High cinematic production value: textured industrial brick, open span ceilings, and water/dock sightlines",
                    f"{reg_info['zone_status']}",
                    "Spacious exterior footprint accommodates large 40ft condor cranes and multi-vehicle camera tracking",
                    "Eligible for regional and state production tax credits"
                ],
                "cons": [
                    "Night exterior shoots require municipal police traffic control monitor for street/dock lane closures",
                    "Ambient industrial noise (adjacent rail/harbor freight) requires wireless lavalier close-miking"
                ],
                "reviews": [
                    {
                        "author": "Jackson Cole",
                        "role": "Production Manager",
                        "rating": 4.7,
                        "quote": "Great industrial depth for action sequences. Local film commission approved the lane closure in under 4 business days. Huge staging area for our Honeywagon and catering tent.",
                        "project_type": "Action Thriller Feature"
                    }
                ],
                "detailed_costs": {
                    "day_rate": day_rate_e1,
                    "permit_fee": reg_info["permit_fee"],
                    "fire_or_police_monitor": 550,
                    "security_or_site_rep": 350,
                    "basecamp_parking": 450,
                    "cleaning_deposit": 400,
                    "crew_travel_zone": reg_info["zone_status"],
                    "total_comprehensive": day_rate_e1 + reg_info["permit_fee"] + 550 + 350 + 450 + 400,
                },
                "local_economy": {
                    "studio_zone_status": reg_info["zone_status"],
                    "tax_incentive": reg_info["tax_credit"],
                    "nearby_vendors": reg_info["rental_houses"],
                    "accommodations_and_crew_hub": reg_info["hub"],
                },
                "sound_and_acoustics": "Semi-isolated industrial acoustic profile; periodic ambient rail/harbor horn frequency.",
                "power_specs": "Generator trailer parking required; 200A temporary power drop available via facility manager.",
                "shared_with_scenes": [str(s.get("scene_id") or s.get("id") or f"sc-{i+1}") for i, s in enumerate(scenes) if i != idx][:2],
                "film_precedents": [
                    {
                        "film": "Collateral (2004)",
                        "director": "Michael Mann",
                        "why": "Exterior night lighting with sodium vapor street ambience and high-contrast wet tarmac.",
                    },
                    {
                        "film": "The Town (2010)",
                        "director": "Ben Affleck",
                        "why": "Urban exfiltration perimeter with multiple approach angles for tactical camera placement.",
                    },
                ],
                "practical_notes": "Night exterior shoot requires notification letter to adjacent businesses; police traffic control required for lane closure.",
                "sources": [
                    {"title": reg_info["permit_office"], "url": reg_info["permit_url"]},
                ],
                "search_grounded": False,
            }

            cand2_breakdown = {"budget_fit": 0.85, "creative_fit": 0.86, "shootability": 0.90, "consolidation_bonus": 0.50}
            cand2 = {
                "candidate_id": f"loc-{idx}-civic",
                "name": f"{sc_region} — Municipal Infrastructure Service Yard",
                "region": sc_region,
                "category": "exterior-street",
                "rank_score": compute_deterministic_rank_score(cand2_breakdown),
                "score_breakdown": cand2_breakdown,
                "estimated_cost": {
                    "day_rate": min(round(sc_budget * 0.35), 2200),
                    "permit_fee": reg_info["permit_fee"],
                    "currency": base_currency,
                    "notes": "City property day rate and standard municipal security deposit.",
                },
                "shared_with_scenes": [],
                "film_precedents": [
                    {
                        "film": "Sicario (2015)",
                        "director": "Denis Villeneuve",
                        "why": "Harsh industrial desert perimeter framing vehicles against imposing architectural barriers.",
                    }
                ],
                "practical_notes": "Secure gated perimeter; ample grip truck parking; weekend availability preferred.",
                "sources": [
                    {"title": reg_info["permit_office"], "url": reg_info["permit_url"]},
                ],
                "search_grounded": False,
            }

            cand_green = make_green_screen_candidate(sc_id, sc_region, sc_budget)
            candidate_list.extend([cand1, cand2, cand_green])

        candidate_list.sort(key=lambda c: c["rank_score"], reverse=True)

        scene_results.append({
            "scene_id": sc_id,
            "scene_number": sc_num,
            "candidates": candidate_list,
        })

    if len(scenes) >= 2:
        cluster_scene_ids = [str(sc.get("scene_id") or sc.get("id") or f"sc-{i+1}") for i, sc in enumerate(scenes[:3])]
        clusters.append({
            "cluster_id": "cluster-financial-district",
            "name": f"{region} — Historic Core Consolidation Hub",
            "region": region,
            "category": "vault / commercial",
            "scene_ids": cluster_scene_ids,
            "candidate_id": f"{shared_loc_id}-a",
            "notes": "Combining vault interior staging and perimeter exfiltration in the same historic financial district eliminates 2 company moves.",
            "estimated_savings": f"~{base_currency} 14,000 saved on crew relocation, truck turnaround, and separate permit riders",
        })

    return {
        "scenes": scene_results,
        "clusters": clusters,
        "_fallback": True,
        "_disclosure": "Live agent/search unreachable — showing offline template estimates, not verified real-time data.",
    }
