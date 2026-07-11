import type { GarmentDefinition } from "@/types/garment";
import gownUrl from "@/assets/garments/placeholder-top.png";
import coatUrl from "@/assets/garments/coat.png";
import slipUrl from "@/assets/garments/slip.png";
import suitUrl from "@/assets/garments/suit.png";

/**
 * The garment catalog — the single file to edit when adding, adjusting,
 * or retiring a garment. Every field the renderer needs lives here;
 * garmentMath.ts and useGarmentRenderer.ts never hardcode per-garment
 * values, they only read GarmentDefinition fields.
 *
 * To add a new garment: add one object below with a real imageUrl and
 * tuned metadata. Nothing else in the codebase needs to change — TryOn.tsx
 * renders whatever getEnabledGarments() returns.
 */
const GARMENT_CATALOG: GarmentDefinition[] = [
  {
    id: "silk-column-gown",
    name: "Silk Column Gown",
    category: "dress",
    imageUrl: gownUrl,
    naturalWidth: 600,
    naturalHeight: 700,
    anchorType: "shoulders",
    defaultScale: 2.1,
    scaleLimits: { min: 1.6, max: 2.6 },
    verticalAnchorOffset: 0.08,
    rotationOffsetRad: 0,
    zIndex: 10,
    enabled: true,
  },
  {
    id: "structured-wool-coat",
    name: "Structured Wool Coat",
    category: "outerwear",
    imageUrl: coatUrl,
    naturalWidth: 700,
    naturalHeight: 900,
    anchorType: "shoulders",
    // Coats read as boxier and sit wider than the body's actual shoulder
    // line — a noticeably higher default scale than the fitted pieces.
    defaultScale: 2.6,
    scaleLimits: { min: 2.1, max: 3.1 },
    verticalAnchorOffset: 0.1,
    rotationOffsetRad: 0,
    // Outerwear draws over tops once multi-garment layering exists.
    zIndex: 20,
    enabled: true,
  },
  {
    id: "draped-satin-slip",
    name: "Draped Satin Slip",
    category: "dress",
    imageUrl: slipUrl,
    naturalWidth: 600,
    naturalHeight: 950,
    anchorType: "shoulders",
    // Thin-strap silhouette sits closer to the body than a gown with
    // sleeves, so it renders narrower relative to shoulder width.
    defaultScale: 1.75,
    scaleLimits: { min: 1.3, max: 2.2 },
    verticalAnchorOffset: 0.02,
    rotationOffsetRad: 0,
    zIndex: 10,
    enabled: true,
  },
  {
    id: "tailored-linen-suit",
    name: "Tailored Linen Suit",
    category: "top",
    imageUrl: suitUrl,
    naturalWidth: 650,
    naturalHeight: 720,
    anchorType: "shoulders",
    // A fitted blazer tracks shoulder width closely.
    defaultScale: 1.95,
    scaleLimits: { min: 1.5, max: 2.4 },
    verticalAnchorOffset: 0.06,
    rotationOffsetRad: 0,
    zIndex: 10,
    enabled: true,
  },
];

// Dev-time sanity check — catches a copy-pasted duplicate id immediately
// instead of surfacing as a confusing "wrong garment selected" bug later.
if (import.meta.env.DEV) {
  const seen = new Set<string>();
  for (const garment of GARMENT_CATALOG) {
    if (seen.has(garment.id)) {
      console.warn(`[garments] Duplicate garment id detected: "${garment.id}"`);
    }
    seen.add(garment.id);
  }
}

/**
 * Returns every enabled garment, sorted by zIndex ascending. Sorting here
 * (rather than in the UI) means any future consumer gets a consistent,
 * paint-order-ready list for free.
 */
export function getEnabledGarments(): GarmentDefinition[] {
  return GARMENT_CATALOG.filter((g) => g.enabled).sort(
    (a, b) => a.zIndex - b.zIndex
  );
}

/** Looks up a single garment by id, enabled or not. Returns undefined if not found. */
export function getGarmentById(id: string): GarmentDefinition | undefined {
  return GARMENT_CATALOG.find((g) => g.id === id);
}