import { BtuFactor, AirconProduct } from '../models';

/**
 * Deterministic BTU / horsepower calculation.
 *
 * The revisions require the recommendation math to be a real, auditable formula
 * driven by the admin-managed BTU factor rows — NOT something the AI guesses.
 * Editing a factor value in Manage BTU Factors must immediately change the
 * result, which happens naturally here because every run reads the current
 * factor rows from the database.
 *
 * Base formula (from the revisions table):
 *   Room Area:      area * (per-sqm factor, default 337)
 *   Ceiling Height: max(0, ceilingHeight - 2.5) * (per-meter factor, default 100)
 *   Occupants:      occupancy * (per-person factor, default 600)
 *   Sunlight:       low=1x, medium=2x, high=3x  *  (sunlight step factor, default 500)
 *   Appliances:     sum of (count * per-unit factor) for each detected appliance
 *
 * HP is derived from total BTU using the ~2400 BTU-per-HP industry rule, then
 * snapped up to the nearest standard AC size so we recommend a real unit.
 */

// --- Canonical factor names ---
// These are the keys the calculator looks up. Admin-facing factor rows should
// use these exact names; the seeder creates them. Values are configurable, so
// the numbers below are only the fallback when a row is missing.

export const CORE_FACTOR_NAMES = {
  areaPerSqm: 'Room Area (per sqm)',
  ceilingPerMeter: 'Ceiling Height (per meter above 2.5m)',
  occupantPerPerson: 'Occupants (per person)',
  sunlightStep: 'Sunlight (per level)',
} as const;

const CORE_FALLBACKS: Record<string, number> = {
  [CORE_FACTOR_NAMES.areaPerSqm]: 337,
  [CORE_FACTOR_NAMES.ceilingPerMeter]: 100,
  [CORE_FACTOR_NAMES.occupantPerPerson]: 600,
  [CORE_FACTOR_NAMES.sunlightStep]: 500,
};

/** Baseline ceiling height; only height above this adds BTU. */
const CEILING_BASELINE_METERS = 2.5;

/** Sunlight tier -> multiplier applied to the sunlight step factor. */
const SUNLIGHT_MULTIPLIER: Record<string, number> = {
  low: 1,
  medium: 2,
  moderate: 2, // the RoomAssessment model stores 'moderate' as the middle tier
  high: 3,
};

/**
 * Approximate BTU delivered per 1 HP of AC capacity. Used only for the
 * preliminary synchronous estimate inside `computeBtu`; the authoritative,
 * table-driven derivation is `deriveHpFromTiers` (Req 1.3, 1.4).
 */
const BTU_PER_HP = 2400;

/**
 * Permitted unit types for a horsepower tier (Req 1.1). Floor-Standing products
 * never form a tier (Req 1.9). Matching is case-insensitive and tolerant of the
 * several spellings the catalog uses ("Window Type", "window-type", "split").
 */
const PERMITTED_TIER_TYPE_PATTERNS: RegExp[] = [/window/i, /split/i];

// --- Appliance factors ---
// Appliances that the room analysis may report. Each maps to a canonical factor
// name; the value (BTU per unit) is admin-configurable via Manage BTU Factors.
// These mirror the appliance list in the revisions document.

export interface ApplianceDefinition {
  key: string;
  factorName: string;
  fallbackBtu: number;
  label: string;
}

export const APPLIANCE_FACTORS: ApplianceDefinition[] = [
  { key: 'television', factorName: 'Television (per unit)', fallbackBtu: 400, label: 'Television' },
  { key: 'desktopComputer', factorName: 'Desktop Computer (per unit)', fallbackBtu: 500, label: 'Desktop Computer' },
  { key: 'laptop', factorName: 'Laptop (per unit)', fallbackBtu: 200, label: 'Laptop' },
  { key: 'refrigerator', factorName: 'Refrigerator (per unit)', fallbackBtu: 500, label: 'Refrigerator' },
  { key: 'microwave', factorName: 'Microwave Oven (per unit)', fallbackBtu: 1000, label: 'Microwave Oven' },
  { key: 'electricFan', factorName: 'Electric Fan (per unit)', fallbackBtu: 100, label: 'Electric Fan' },
  { key: 'printer', factorName: 'Printer (per unit)', fallbackBtu: 300, label: 'Printer' },
  { key: 'lighting', factorName: 'Lighting Fixtures (per fixture)', fallbackBtu: 100, label: 'Lighting Fixtures' },
  { key: 'gamingPc', factorName: 'Gaming PC (per unit)', fallbackBtu: 700, label: 'Gaming PC' },
  { key: 'serverEquipment', factorName: 'Server / Network Equipment (per unit)', fallbackBtu: 1000, label: 'Server / Network Equipment' },
];

const APPLIANCE_BY_KEY = new Map(APPLIANCE_FACTORS.map((a) => [a.key, a]));

// --- Types ---

export interface BtuCalculationInput {
  area: number;
  ceilingHeight: number;
  occupancy: number;
  /** 'low' | 'medium' | 'moderate' | 'high' (case-insensitive) */
  sunlightLevel: string;
  /**
   * Detected/declared appliance counts keyed by ApplianceDefinition.key.
   * Only appliances present as BTU factor rows contribute — unknown items are
   * ignored so they can't corrupt the computation.
   */
  appliances?: Record<string, number>;
}

/** One line of the computation breakdown, for the table-style UI. */
export interface BtuBreakdownLine {
  label: string;
  formula: string;
  btu: number;
}

export interface BtuCalculationResult {
  totalBtu: number;
  recommendedHp: number;
  breakdown: BtuBreakdownLine[];
  /** Appliance factor names that were requested but had no matching factor row. */
  ignoredAppliances: string[];
}

// --- Factor lookup ---

/** Case-insensitive, trimmed lookup of a factor row's value by canonical name. */
function resolveFactor(
  factors: BtuFactor[],
  name: string,
  fallback: number
): number {
  const target = name.trim().toLowerCase();
  const match = factors.find((f) => f.factorName.trim().toLowerCase() === target);
  const value = match ? Number(match.factorValue) : fallback;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function round(n: number): number {
  return Math.round(n);
}

// ---------------------------------------------------------------------------
// Table-driven HP derivation (Task 7.1 / Requirement 1, C1)
// ---------------------------------------------------------------------------
//
// The recommended horsepower is derived from the horsepower tiers actually
// present in the products catalog rather than a hardcoded BTU-per-HP divisor
// (Req 1.3, 1.4). A tier is one (horsepower, ratedBtu) pair sourced from an
// active Window/Split product row; Floor-Standing products never form a tier
// (Req 1.9). `deriveHpFromTiers` is pure so it can be property-tested without
// I/O; `buildHpTiersFromCatalog` reads the current catalog rows.

/** One horsepower tier: a HP value and the rated BTU capacity it covers. */
export interface HpTier {
  horsepower: number;
  ratedBtu: number;
  /** The product row backing this tier (for populating the unit card). */
  productId?: number | null;
}

export type HpDerivationKind = 'matched' | 'exceeds-largest' | 'no-tier' | 'no-catalog';

export interface HpDerivation {
  /**
   * - `matched`         a tier covers the load; `recommendedHp` is set.
   * - `exceeds-largest` the load is above every tier; `recommendedHp` /
   *                     `tierProductId` point at the largest tier (Req 1.9).
   * - `no-tier`         tiers exist but none qualify (Req 1.13); no HP/card.
   * - `no-catalog`      no tiers at all (Req 1.14); no HP/card.
   */
  kind: HpDerivationKind;
  recommendedHp: number | null;
  /**
   * The product row backing the recommended tier, or the largest tier for
   * `exceeds-largest`. Null for `no-tier` / `no-catalog`.
   */
  tierProductId: number | null;
}

/**
 * Derives the recommended horsepower for a BTU load from a set of catalog HP
 * tiers. Pure and deterministic (Req 1.3, 1.4, 1.9, 1.13, 1.14 / Property 1).
 *
 * Selection rule: the smallest tier whose `ratedBtu >= loadBtu`; among tiers
 * that share the smallest qualifying `ratedBtu`, the one with the lowest
 * `horsepower` (lowest-HP tie-break, Req 1.3).
 */
export function deriveHpFromTiers(loadBtu: number, tiers: HpTier[]): HpDerivation {
  // Keep only well-formed tiers (finite, positive HP and rated BTU).
  const valid = (tiers ?? []).filter(
    (t) =>
      t &&
      Number.isFinite(t.horsepower) &&
      t.horsepower > 0 &&
      Number.isFinite(t.ratedBtu) &&
      t.ratedBtu > 0
  );

  // No tiers at all -> recommendations unavailable (Req 1.14).
  if (valid.length === 0) {
    return { kind: 'no-catalog', recommendedHp: null, tierProductId: null };
  }

  const load = Number.isFinite(loadBtu) ? loadBtu : 0;

  // Qualifying tiers: rated BTU covers the load.
  const qualifying = valid.filter((t) => t.ratedBtu >= load);

  if (qualifying.length === 0) {
    // Load exceeds every tier -> point at the largest tier (Req 1.9).
    // Largest = highest rated BTU; tie-break on highest HP so the card shows
    // the biggest real unit available.
    const largest = valid.reduce((best, t) => {
      if (t.ratedBtu > best.ratedBtu) return t;
      if (t.ratedBtu === best.ratedBtu && t.horsepower > best.horsepower) return t;
      return best;
    });
    return {
      kind: 'exceeds-largest',
      recommendedHp: largest.horsepower,
      tierProductId: largest.productId ?? null,
    };
  }

  // Smallest qualifying rated BTU; among ties, lowest HP (Req 1.3).
  const chosen = qualifying.reduce((best, t) => {
    if (t.ratedBtu < best.ratedBtu) return t;
    if (t.ratedBtu === best.ratedBtu && t.horsepower < best.horsepower) return t;
    return best;
  });

  return {
    kind: 'matched',
    recommendedHp: chosen.horsepower,
    tierProductId: chosen.productId ?? null,
  };
}

/** True when a product `type` string is a permitted tier type (Window/Split). */
export function isPermittedTierType(type: string | null | undefined): boolean {
  if (typeof type !== 'string') return false;
  return PERMITTED_TIER_TYPE_PATTERNS.some((re) => re.test(type));
}

/**
 * Builds the HP tiers from the active Window/Split products in the catalog
 * (Req 1.4). Floor-Standing (and any other) types are excluded (Req 1.9).
 * Tiers are returned sorted by rated BTU ascending, then HP ascending.
 */
export async function buildHpTiersFromCatalog(): Promise<HpTier[]> {
  // `paranoid: true` on AirconProduct already excludes archived (soft-deleted)
  // rows, so restricting to active products is sufficient (Req 1.4).
  const products = await AirconProduct.findAll({
    where: { isActive: true },
  });

  return products
    .filter((p) => isPermittedTierType(p.type))
    .map((p) => ({
      horsepower: Number(p.horsepower),
      ratedBtu: Number(p.btuCapacity),
      productId: p.id,
    }))
    .filter(
      (t) =>
        Number.isFinite(t.horsepower) &&
        t.horsepower > 0 &&
        Number.isFinite(t.ratedBtu) &&
        t.ratedBtu > 0
    )
    .sort((a, b) => a.ratedBtu - b.ratedBtu || a.horsepower - b.horsepower);
}

/**
 * Preliminary synchronous HP estimate used only to populate the pure
 * `computeBtu` result. The authoritative recommendation runs the table-driven
 * `deriveHpFromTiers` against the catalog (Req 1.3, 1.4); the AI recommendation
 * path reconciles to that value. Kept internal so no caller depends on the old
 * hardcoded snap-to-standard-size behavior.
 */
function estimateHpFromBtu(totalBtu: number): number {
  const rawHp = totalBtu / BTU_PER_HP;
  // Round up to the nearest 0.5 HP so the estimate is a plausible unit size.
  return Math.max(0.5, Math.ceil(rawHp * 2) / 2);
}

// --- Main computation ---

/**
 * Computes total BTU and recommended HP from room data using the current
 * BTU factor rows. Pure and deterministic given the same inputs + factor rows.
 */
export function computeBtu(
  input: BtuCalculationInput,
  factors: BtuFactor[]
): BtuCalculationResult {
  const breakdown: BtuBreakdownLine[] = [];

  const areaFactor = resolveFactor(factors, CORE_FACTOR_NAMES.areaPerSqm, CORE_FALLBACKS[CORE_FACTOR_NAMES.areaPerSqm]);
  const ceilingFactor = resolveFactor(factors, CORE_FACTOR_NAMES.ceilingPerMeter, CORE_FALLBACKS[CORE_FACTOR_NAMES.ceilingPerMeter]);
  const occupantFactor = resolveFactor(factors, CORE_FACTOR_NAMES.occupantPerPerson, CORE_FALLBACKS[CORE_FACTOR_NAMES.occupantPerPerson]);
  const sunlightStep = resolveFactor(factors, CORE_FACTOR_NAMES.sunlightStep, CORE_FALLBACKS[CORE_FACTOR_NAMES.sunlightStep]);

  // 1. Room area
  const areaBtu = round(input.area * areaFactor);
  breakdown.push({
    label: 'Room Area',
    formula: `${input.area} sqm x ${areaFactor}`,
    btu: areaBtu,
  });

  // 2. Ceiling height above the 2.5m baseline
  const extraHeight = Math.max(0, input.ceilingHeight - CEILING_BASELINE_METERS);
  const ceilingBtu = round(extraHeight * ceilingFactor);
  breakdown.push({
    label: 'Ceiling Height',
    formula: `(${input.ceilingHeight}m - ${CEILING_BASELINE_METERS}m) x ${ceilingFactor}`,
    btu: ceilingBtu,
  });

  // 3. Occupants
  const occupantBtu = round(input.occupancy * occupantFactor);
  breakdown.push({
    label: 'Occupants',
    formula: `${input.occupancy} person(s) x ${occupantFactor}`,
    btu: occupantBtu,
  });

  // 4. Sunlight tier
  const tier = SUNLIGHT_MULTIPLIER[input.sunlightLevel.trim().toLowerCase()] ?? 1;
  const sunlightBtu = round(tier * sunlightStep);
  const tierLabel = input.sunlightLevel.trim().toLowerCase();
  breakdown.push({
    label: `Sunlight (${tierLabel})`,
    formula: `${tier} x ${sunlightStep}`,
    btu: sunlightBtu,
  });

  // 5. Appliances — only those with a matching factor row contribute.
  const ignoredAppliances: string[] = [];
  if (input.appliances) {
    for (const [key, rawCount] of Object.entries(input.appliances)) {
      const count = Number(rawCount);
      if (!Number.isFinite(count) || count <= 0) continue;

      const def = APPLIANCE_BY_KEY.get(key);
      if (!def) {
        ignoredAppliances.push(key);
        continue;
      }

      // An appliance only counts if its BTU factor row actually exists; a
      // missing row means the admin hasn't configured it, so skip it rather
      // than silently inventing a value.
      const hasRow = factors.some(
        (f) => f.factorName.trim().toLowerCase() === def.factorName.trim().toLowerCase()
      );
      if (!hasRow) {
        ignoredAppliances.push(def.label);
        continue;
      }

      const perUnit = resolveFactor(factors, def.factorName, def.fallbackBtu);
      const applianceBtu = round(count * perUnit);
      breakdown.push({
        label: def.label,
        formula: `${count} x ${perUnit}`,
        btu: applianceBtu,
      });
    }
  }

  const totalBtu = breakdown.reduce((sum, line) => sum + line.btu, 0);
  const recommendedHp = estimateHpFromBtu(totalBtu);

  return { totalBtu, recommendedHp, breakdown, ignoredAppliances };
}

/**
 * Convenience wrapper that loads the current factor rows and computes.
 * Every recommendation goes through this so edits to factors take effect at once.
 */
export async function computeBtuFromDb(
  input: BtuCalculationInput
): Promise<BtuCalculationResult> {
  const factors = await BtuFactor.findAll();
  return computeBtu(input, factors);
}

// ---------------------------------------------------------------------------
// OpenCV-assisted BTU uplift (Task 8.2 / Requirement 3, C3)
// ---------------------------------------------------------------------------
//
// The image-derived contribution is expressed as an explicit, capped, and
// line-itemized adjustment on top of the form-only Base_Load. Making the uplift
// the SUM of labeled line items (rather than an opaque appliance count folded
// into computeBtu) guarantees three invariants:
//
//   * Property 5 — the returned line items sum to the returned total (±1 BTU),
//     because the total is derived AS the sum of the line items.
//   * Property 6 — heat sources declared on the form and detected in the image
//     are unioned into one set keyed by normalized label, so a source present
//     in both counts exactly once.
//   * Property 7 — the combined uplift is clamped to `capFraction * baseLoadBtu`
//     (default 0.15, configurable via OPENCV_UPLIFT_CAP_FRACTION), so the totals
//     with and without a photo differ by at most the cap.
//
// Graceful degradation when image analysis is unavailable (Req 3.11) and the
// narrative-facts construction (Req 3.5–3.7) are handled separately in Task 8.3;
// this function computes the capped, line-itemized uplift only.
//
// NOTE ON PER-METRIC BTU VALUES: the design (section C3) fixes the input/output
// shapes and the three invariants above but does not tabulate a specific BTU
// value per window / heat source / insulation or sunlight level. The constants
// below are chosen to sit in the same magnitude band the codebase already uses
// for load contributions (sunlight step 500, appliance factors 100–1000) and
// are centralized here so they can be tuned without touching the summing,
// union, or capping logic that the correctness properties depend on.

/** Default fraction of Base_Load the combined OpenCV uplift may not exceed. */
export const DEFAULT_OPENCV_UPLIFT_CAP_FRACTION = 0.15;

/** BTU added per window detected in the room image. */
export const OPENCV_BTU_PER_WINDOW = 300;

/** BTU added per distinct heat source (form-declared or image-detected). */
export const OPENCV_BTU_PER_HEAT_SOURCE = 400;

/** BTU added for the insulation quality reported by the image analysis. */
export const OPENCV_BTU_BY_INSULATION: Record<'poor' | 'fair' | 'good', number> = {
  poor: 800,
  fair: 300,
  good: 0,
};

/** BTU added for the sunlight level reported by the image analysis. */
export const OPENCV_BTU_BY_SUNLIGHT: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 300,
  high: 600,
};

export type InsulationQuality = 'poor' | 'fair' | 'good';
export type SunlightLevel = 'low' | 'medium' | 'high';

export interface UpliftInput {
  /** BTU computed from the customer's form inputs only (Base_Load). */
  baseLoadBtu: number;
  /** Number of windows detected by the image analysis. */
  windowCount: number;
  /** Insulation quality reported by the image analysis. */
  insulationQuality: InsulationQuality;
  /** Sunlight level reported by the image analysis. */
  sunlightLevel: SunlightLevel;
  /** Heat sources the customer declared on the form. */
  formHeatSources: string[];
  /** Heat sources detected in the room image. */
  imageHeatSources: string[];
  /**
   * Fraction of Base_Load the combined uplift may not exceed. Defaults to
   * OPENCV_UPLIFT_CAP_FRACTION env (or 0.15). Req 3.4 / Q9.
   */
  capFraction?: number;
}

/** One labeled uplift contribution. */
export interface UpliftLineItem {
  key: string;
  label: string;
  btu: number;
}

/**
 * Facts about the room derived ONLY from measured image values, used to steer
 * the advisory narrative so it never claims something the measurements do not
 * support (Req 3.5–3.7 / Property 8). `multipleWindows` is true only when more
 * than one window was measured (Req 3.6); `poorInsulation` is true only when
 * the measured insulation quality is `poor` (Req 3.7).
 */
export interface NarrativeFacts {
  /** Measured window count. */
  windows: number;
  /** True only when more than one window was measured (Req 3.6). */
  multipleWindows: boolean;
  /** True only when the measured insulation quality is `poor` (Req 3.7). */
  poorInsulation: boolean;
  /** Measured sunlight level. */
  sunlight: SunlightLevel;
  /** The distinct heat sources counted (union of form + image). */
  heatSources: string[];
}

export interface UpliftResult {
  /** Each image-derived adjustment as a separate labeled line item (Req 3.1). */
  lineItems: UpliftLineItem[];
  /** Raw summed uplift before the cap is applied. */
  rawUpliftBtu: number;
  /** Uplift after clamping to capFraction * baseLoadBtu (Req 3.4). */
  cappedUpliftBtu: number;
  /** capFraction * baseLoadBtu — the ceiling applied to rawUpliftBtu. */
  capBtu: number;
  /** True when rawUpliftBtu exceeded the cap and was clamped. */
  capApplied: boolean;
  /** baseLoadBtu + cappedUpliftBtu. */
  totalBtu: number;
  /** The distinct heat sources counted (union of form + image), one entry each. */
  countedHeatSources: string[];
  /** The cap fraction actually used. */
  capFraction: number;
  /** Facts derived only from measured values, for the advisory narrative (Req 3.5–3.7). */
  narrativeFacts: NarrativeFacts;
}

/** Reads the configured uplift cap fraction, falling back to the default. */
function resolveCapFraction(explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const envValue = Number(process.env.OPENCV_UPLIFT_CAP_FRACTION);
  if (Number.isFinite(envValue) && envValue >= 0) {
    return envValue;
  }
  return DEFAULT_OPENCV_UPLIFT_CAP_FRACTION;
}

/**
 * Unions form-declared and image-detected heat sources so a source present in
 * both is counted exactly once (Req 3.3 / Property 6). Matching is
 * case-insensitive and whitespace-insensitive; the first-seen display form is
 * preserved for labeling.
 */
function unionHeatSources(formSources: string[], imageSources: string[]): string[] {
  const seen = new Map<string, string>(); // normalized key -> display form
  for (const raw of [...(formSources ?? []), ...(imageSources ?? [])]) {
    if (typeof raw !== 'string') continue;
    const display = raw.trim();
    if (display.length === 0) continue;
    const key = display.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, display);
    }
  }
  return Array.from(seen.values());
}

/**
 * Computes the capped, line-itemized OpenCV uplift on top of a form-only
 * Base_Load. Pure and deterministic given the same input.
 *
 * The total is derived as `baseLoadBtu` plus the SUM of the returned uplift line
 * items after capping, so the reported line items always reconcile to the
 * reported total within ±1 BTU (Property 5).
 */
export function computeOpenCvUplift(input: UpliftInput): UpliftResult {
  const capFraction = resolveCapFraction(input.capFraction);
  const baseLoadBtu = Number.isFinite(input.baseLoadBtu) && input.baseLoadBtu > 0 ? input.baseLoadBtu : 0;

  const lineItems: UpliftLineItem[] = [];

  // 1. Windows
  const windowCount = Number.isFinite(input.windowCount) && input.windowCount > 0
    ? Math.floor(input.windowCount)
    : 0;
  if (windowCount > 0) {
    lineItems.push({
      key: 'windows',
      label: `Windows (${windowCount})`,
      btu: round(windowCount * OPENCV_BTU_PER_WINDOW),
    });
  }

  // 2. Insulation
  const insulationBtu = OPENCV_BTU_BY_INSULATION[input.insulationQuality] ?? 0;
  if (insulationBtu > 0) {
    lineItems.push({
      key: 'insulation',
      label: `Insulation (${input.insulationQuality})`,
      btu: round(insulationBtu),
    });
  }

  // 3. Sunlight
  const sunlightBtu = OPENCV_BTU_BY_SUNLIGHT[input.sunlightLevel] ?? 0;
  if (sunlightBtu > 0) {
    lineItems.push({
      key: 'sunlight',
      label: `Sunlight (${input.sunlightLevel})`,
      btu: round(sunlightBtu),
    });
  }

  // 4. Heat sources — union so each distinct source counts once (Req 3.3).
  const countedHeatSources = unionHeatSources(input.formHeatSources, input.imageHeatSources);
  if (countedHeatSources.length > 0) {
    lineItems.push({
      key: 'heatSources',
      label: `Heat sources (${countedHeatSources.length}): ${countedHeatSources.join(', ')}`,
      btu: round(countedHeatSources.length * OPENCV_BTU_PER_HEAT_SOURCE),
    });
  }

  // Raw uplift is the sum of the labeled line items.
  const rawUpliftBtu = lineItems.reduce((sum, item) => sum + item.btu, 0);

  // Clamp the combined uplift to capFraction * baseLoadBtu (Req 3.4 / Property 7).
  const capBtu = round(capFraction * baseLoadBtu);
  const cappedUpliftBtu = Math.min(rawUpliftBtu, capBtu);
  const capApplied = rawUpliftBtu > capBtu;

  // Narrative facts are built ONLY from the measured values (Req 3.5). A
  // multi-window claim is asserted only when more than one window was measured
  // (Req 3.6); a poor-insulation claim only when insulation measured `poor`
  // (Req 3.7). No claim is included that a measured value does not back.
  const narrativeFacts: NarrativeFacts = {
    windows: windowCount,
    multipleWindows: windowCount > 1,
    poorInsulation: input.insulationQuality === 'poor',
    sunlight: input.sunlightLevel,
    heatSources: countedHeatSources,
  };

  return {
    lineItems,
    rawUpliftBtu,
    cappedUpliftBtu,
    capBtu,
    capApplied,
    totalBtu: baseLoadBtu + cappedUpliftBtu,
    countedHeatSources,
    capFraction,
    narrativeFacts,
  };
}
