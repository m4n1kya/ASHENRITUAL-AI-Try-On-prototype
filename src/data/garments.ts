import type { GarmentDefinition } from "@/types/garment";
import gownUrl from "@/assets/garments/placeholder-top.png";
import coatUrl from "@/assets/garments/coat.png";
import slipUrl from "@/assets/garments/slip.png";
import suitUrl from "@/assets/garments/suit.png";

/**
 * Placeholder garment catalog.
 *
 * Real garment data (multiple capture angles, physics metadata, fabric
 * properties) will replace this once the content pipeline exists — the
 * GarmentDefinition shape is designed to accommodate that without
 * breaking any consumer of this file.
 *
 * `shoulderWidthMultiplier` and `verticalAnchorOffset` are tuned per
 * garment rather than hardcoded in the math utilities (garmentMath.ts),
 * so a boxy coat and a fitted slip dress can each render correctly
 * without any branching logic in the render pipeline itself — the
 * pipeline just reads whatever numbers the selected garment carries.
 */
export const PLACEHOLDER_GARMENTS: GarmentDefinition[] = [
  {
    id: "silk-column-gown",
    name: "Silk Column Gown",
    category: "dress",
    imageUrl: gownUrl,
    naturalWidth: 600,
    naturalHeight: 700,
    shoulderWidthMultiplier: 2.1,
    verticalAnchorOffset: 0.08,
  },
  {
    id: "structured-wool-coat",
    name: "Structured Wool Coat",
    category: "outerwear",
    imageUrl: coatUrl,
    naturalWidth: 700,
    naturalHeight: 900,
    // Coats read as boxier and sit wider than the body's actual shoulder
    // line — a noticeably higher multiplier than the fitted pieces below.
    shoulderWidthMultiplier: 2.6,
    verticalAnchorOffset: 0.1,
  },
  {
    id: "draped-satin-slip",
    name: "Draped Satin Slip",
    category: "dress",
    imageUrl: slipUrl,
    naturalWidth: 600,
    naturalHeight: 950,
    // Thin-strap silhouette sits closer to the body than a gown with
    // sleeves, so it renders narrower relative to shoulder width.
    shoulderWidthMultiplier: 1.75,
    verticalAnchorOffset: 0.02,
  },
  {
    id: "tailored-linen-suit",
    name: "Tailored Linen Suit",
    category: "top",
    imageUrl: suitUrl,
    naturalWidth: 650,
    naturalHeight: 720,
    // A fitted blazer tracks shoulder width closely.
    shoulderWidthMultiplier: 1.95,
    verticalAnchorOffset: 0.06,
  },
];
