import { GeoPoint, GeoPolygon, Discount } from '../types/mall';

// Dwell time tracking for each user-mall pair
const dwellTimeTracking = new Map<string, {
  enteredAt: Date;
  lastLocation: GeoPoint;
  isInside: boolean;
}>();

// Get or create dwell time tracker for user-mall pair
function getDwellTimeTracker(userId: string, mallId: string) {
  const key = `${userId}-${mallId}`;
  return dwellTimeTracking.get(key);
}

function setDwellTimeTracker(userId: string, mallId: string, data: {
  enteredAt: Date;
  lastLocation: GeoPoint;
  isInside: boolean;
}) {
  const key = `${userId}-${mallId}`;
  dwellTimeTracking.set(key, data);
}

// Calculate dwell time in seconds for a user-mall pair
export function getDwellTime(userId: string, mallId: string): number {
  const tracker = getDwellTimeTracker(userId, mallId);
  if (!tracker || !tracker.isInside) return 0;

  const now = new Date();
  const dwellSeconds = (now.getTime() - tracker.enteredAt.getTime()) / 1000;
  return dwellSeconds;
}

// Update user location and track dwell time
export function updateUserLocation(userId: string, mallId: string, location: GeoPoint, mallPolygon: GeoPolygon): {
  isInside: boolean;
  dwellTime: number;
  justEntered: boolean;
  justExited: boolean;
} {
  const inside = isPointInPolygon(location, mallPolygon);
  const tracker = getDwellTimeTracker(userId, mallId);
  const now = new Date();

  let justEntered = false;
  let justExited = false;

  if (inside) {
    if (!tracker || !tracker.isInside) {
      // User just entered the polygon
      setDwellTimeTracker(userId, mallId, {
        enteredAt: now,
        lastLocation: location,
        isInside: true
      });
      justEntered = true;
    } else {
      // User is still inside, update location
      setDwellTimeTracker(userId, mallId, {
        ...tracker,
        lastLocation: location
      });
    }
  } else {
    if (tracker && tracker.isInside) {
      // User just exited the polygon
      setDwellTimeTracker(userId, mallId, {
        ...tracker,
        isInside: false
      });
      justExited = true;
    }
  }

  const dwellTime = getDwellTime(userId, mallId);

  return {
    isInside: inside,
    dwellTime,
    justEntered,
    justExited
  };
}

// Ray casting algorithm to check if point is inside polygon
export function isPointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
  const { lat, lng } = point;
  const { coordinates } = polygon;
  
  let inside = false;
  
  for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
    const xi = coordinates[i].lng;
    const yi = coordinates[i].lat;
    const xj = coordinates[j].lng;
    const yj = coordinates[j].lat;
    
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Calculate distance between two points in meters using Haversine formula
export function calculateDistance(point1: GeoPoint, point2: GeoPoint): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

// Calculate velocity in km/h given distance (meters) and time (seconds)
export function calculateVelocity(distance: number, timeSeconds: number): number {
  if (timeSeconds === 0) return 0;
  const velocityMps = distance / timeSeconds; // meters per second
  return velocityMps * 3.6; // convert to km/h
}

// Smart Push Trigger logic according to technical documentation
// Trigger = True if (V < V_walk) AND (T_dwell > 2min) AND (InsidePolygon)
export interface TriggerResult {
  shouldTrigger: boolean;
  reason?: string;
  velocity?: number;
  dwellTime?: number;
  insidePolygon?: boolean;
}

export function evaluateSmartPushTrigger(params: {
  velocity: number; // km/h
  dwellTime: number; // seconds
  insidePolygon: boolean;
}): TriggerResult {
  const V_walk = 5; // 5 km/h
  const T_dwell_min = 120; // 2 minutes in seconds
  
  const velocityCheck = params.velocity < V_walk;
  const dwellTimeCheck = params.dwellTime > T_dwell_min;
  const polygonCheck = params.insidePolygon;
  
  if (velocityCheck && dwellTimeCheck && polygonCheck) {
    return {
      shouldTrigger: true,
      velocity: params.velocity,
      dwellTime: params.dwellTime,
      insidePolygon: true
    };
  }
  
  const reasons: string[] = [];
  if (!velocityCheck) reasons.push(`Velocity ${params.velocity.toFixed(1)} km/h >= ${V_walk} km/h`);
  if (!dwellTimeCheck) reasons.push(`Dwell time ${params.dwellTime}s <= ${T_dwell_min}s`);
  if (!polygonCheck) reasons.push('Not inside polygon');
  
  return {
    shouldTrigger: false,
    reason: reasons.join('; '),
    velocity: params.velocity,
    dwellTime: params.dwellTime,
    insidePolygon: false
  };
}

// Top Discount Selection Algorithm
// Selects the best discount based on:
// 1. Discount amount (higher is better)
// 2. Distance to user (closer is better)
// 3. Validity period (more time left is better)
// 4. User's proximity to mall (inside polygon is priority)
export interface TopDiscountParams {
  discounts: Discount[];
  userLocation?: GeoPoint;
  mallPolygon?: GeoPolygon;
  userPreferences?: {
    categories?: string[];
    maxDistance?: number; // meters
  };
}

export function selectTopDiscount(params: TopDiscountParams): Discount | null {
  const { discounts, userLocation, mallPolygon, userPreferences } = params;

  if (!discounts || discounts.length === 0) return null;

  // Filter by user preferences
  let filtered = discounts;
  if (userPreferences?.categories && userPreferences.categories.length > 0) {
    filtered = filtered.filter(d => userPreferences.categories!.includes(d.category));
  }

  if (filtered.length === 0) return null;

  // Score each discount
  const scoredDiscounts = filtered.map(discount => {
    let score = 0;

    // 1. Discount amount score (0-30 points)
    const discountPercent = parseInt(discount.discountAmount.replace(/[^0-9]/g, '')) || 0;
    score += Math.min(discountPercent / 2, 30);

    // 2. Proximity score (0-25 points)
    if (userLocation && mallPolygon) {
      const inside = isPointInPolygon(userLocation, mallPolygon);
      if (inside) {
        score += 25; // Priority for users inside the mall
      } else if (discount.mallId) {
        // Calculate distance to mall center (simplified)
        const distance = calculateDistance(userLocation, { lat: 41.3, lng: 69.3 }); // Approximate center
        if (userPreferences?.maxDistance && distance <= userPreferences.maxDistance) {
          score += Math.max(0, 25 - (distance / userPreferences.maxDistance) * 25);
        }
      }
    }

    // 3. Validity period score (0-25 points)
    if (discount.validUntil) {
      const validUntil = new Date(discount.validUntil);
      const now = new Date();
      const daysLeft = (validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLeft > 0) {
        score += Math.min(daysLeft, 7) / 7 * 25; // Max score for 7+ days left
      }
    }

    // 4. Recency score (0-20 points) - newer discounts are prioritized
    if (discount.createdAt) {
      const createdAt = new Date(discount.createdAt);
      const now = new Date();
      const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 20 - hoursSinceCreation); // Max score for very recent
    }

    return { discount, score };
  });

  // Sort by score descending and return the top one
  scoredDiscounts.sort((a, b) => b.score - a.score);
  return scoredDiscounts[0]?.discount || null;
}
