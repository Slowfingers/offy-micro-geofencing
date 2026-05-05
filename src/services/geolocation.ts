import { GeoPoint, GeoPolygon } from '../types/mall';

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
