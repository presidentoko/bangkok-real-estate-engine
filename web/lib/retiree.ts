// web/lib/retiree.ts
// Retiree Suitability Score — "is this a good place to retire?"
//
// Thailand draws a huge retirement-visa buyer pool, yet no portal frames a
// building for them. We can, from data we already compute per building:
//   * healthcare proximity (hospitals/clinics within 1km) — the #1 concern
//   * air quality (WAQI AQI) — respiratory sensitivity rises with age
//   * car-free mobility (distance to nearest BTS/MRT)
//   * daily errands (supermarkets within 1km)
//
// Pure functions, no I/O — unit-tested with node:test. The score is computed
// from data the condo page already fetches, so this needs no DB migration.

export type RetireeInputs = {
  hospitalsWithin1km: number | null;
  aqiScore: number | null;
  supermarketsWithin1km: number | null;
  /** Distance in metres to the nearest rail station (min of BTS / MRT). */
  nearestTransitM: number | null;
};

export type RetireeGrade = "excellent" | "good" | "fair" | "weak";

export type RetireeScore = {
  score: number;
  grade: RetireeGrade;
  components: {
    healthcare: number;
    air: number;
    transit: number;
    errands: number;
  };
  /** "low" when the AQI signal is missing and weights were renormalised. */
  confidence: "ok" | "low";
};

// Weights when every signal is present. Healthcare dominates because it is the
// decisive factor for most retirees; air quality is a strong second.
const W = { healthcare: 0.4, air: 0.25, transit: 0.2, errands: 0.15 };

function healthcareScore(hospitals: number): number {
  if (hospitals <= 0) return 10;
  if (hospitals === 1) return 55;
  if (hospitals === 2) return 75;
  if (hospitals === 3) return 88;
  return 100;
}

// Lower AQI is better. Thresholds follow the standard WAQI bands.
function airScore(aqi: number): number {
  if (aqi <= 25) return 100;
  if (aqi <= 50) return 85;
  if (aqi <= 75) return 65;
  if (aqi <= 100) return 45;
  if (aqi <= 150) return 25;
  return 8;
}

function transitScore(metres: number | null): number {
  if (metres == null) return 20;
  if (metres <= 300) return 100;
  if (metres <= 500) return 85;
  if (metres <= 800) return 65;
  if (metres <= 1200) return 40;
  return 15;
}

function errandsScore(supermarkets: number | null): number {
  const n = supermarkets ?? 0;
  if (n <= 0) return 15;
  if (n === 1) return 55;
  if (n === 2) return 75;
  return 95;
}

function grade(score: number): RetireeGrade {
  if (score >= 75) return "excellent";
  if (score >= 55) return "good";
  if (score >= 35) return "fair";
  return "weak";
}

/**
 * Returns null when we lack the core healthcare signal (i.e. livability has not
 * been computed for this building) — better to show nothing than a guess.
 */
export function retireeSuitability(input: RetireeInputs): RetireeScore | null {
  if (input.hospitalsWithin1km == null) return null;

  const healthcare = healthcareScore(input.hospitalsWithin1km);
  const transit = transitScore(input.nearestTransitM);
  const errands = errandsScore(input.supermarketsWithin1km);
  const hasAir = input.aqiScore != null;
  const air = hasAir ? airScore(input.aqiScore as number) : 0;

  let score: number;
  if (hasAir) {
    score =
      W.healthcare * healthcare +
      W.air * air +
      W.transit * transit +
      W.errands * errands;
  } else {
    // Renormalise the remaining three weights so a missing AQI doesn't just
    // drag the score down to zero on the air component.
    const denom = W.healthcare + W.transit + W.errands;
    score =
      (W.healthcare * healthcare + W.transit * transit + W.errands * errands) /
      denom;
  }

  const rounded = Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
  return {
    score: rounded,
    grade: grade(rounded),
    components: { healthcare, air, transit, errands },
    confidence: hasAir ? "ok" : "low",
  };
}
