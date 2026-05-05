export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoPolygon {
  coordinates: GeoPoint[];
}

export interface Mall {
  id: string;
  name: string;
  address?: string;
  polygon: GeoPolygon;
  center: GeoPoint;
  createdAt: string;
  updatedAt: string;
}

export interface UserLocation {
  userId: string;
  lat: number;
  lng: number;
  timestamp: string;
  velocity?: number; // km/h
  accuracy?: number; // meters
}

export interface UserSession {
  userId: string;
  mallId?: string;
  enteredAt?: string;
  dwellStartTime?: string;
  lastLocation: GeoPoint;
  isInside: boolean;
}

export interface SmartPushTrigger {
  userId: string;
  mallId: string;
  triggeredAt: string;
  velocity: number;
  dwellTime: number; // seconds
  insidePolygon: boolean;
}

export interface Discount {
  id: string;
  mallId?: string;
  title: string;
  description: string;
  image?: string;
  source?: string;
  isTopOffer?: boolean;
  priority?: number;
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  isFlash?: boolean; // Flash discount for Premium
  brandId?: string; // For B2B partnership
}

// Review and Moderation System
export interface Review {
  id: string;
  userId: string;
  discountId: string;
  mallId?: string;
  rating: number; // 1-5
  text: string;
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  isFiltered: boolean; // Auto-filtered as spam/junk
  filterReason?: string;
  brandResponse?: string; // B2B Control: brand owner response
  brandId?: string;
}

export interface ModerationAction {
  id: string;
  reviewId: string;
  action: 'approve' | 'reject' | 'flag';
  reason?: string;
  moderatorId: string;
  createdAt: string;
}

// B2B Model
export type PlanType = 'standard' | 'premium';

export interface Brand {
  id: string;
  name: string;
  plan: PlanType;
  mallIds: string[];
  scratchCodes?: string[]; // For Premium Scratch to Win
  createdAt: string;
  updatedAt: string;
}

export interface FlashDiscount {
  id: string;
  brandId: string;
  mallId: string;
  title: string;
  description: string;
  discountValue: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

// Flying Clouds - Social Engine
export interface FloatingComment {
  id: string;
  userId: string;
  discountId: string;
  text: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  createdAt: string;
}
