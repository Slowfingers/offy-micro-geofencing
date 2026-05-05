import { Review } from '../types/mall';

// Auto-Filter patterns for spam/junk detection
const SPAM_PATTERNS = [
  // Meaningless character sets
  /^[a-zA-Z0-9\s]{1,10}$/, // Too short or random chars
  /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]+$/, // Only special chars
  /(.)\1{4,}/, // Repeated characters (aaaaa, 11111)
  
  // Common spam phrases
  /\b(buy now|click here|free money|win prize|subscribe|follow back)\b/i,
  /\b(viagra|cialis|casino|bitcoin|crypto|lottery)\b/i,
  /\b(http|https|www\.|\.com|\.net|\.org)/i, // URLs
  
  // Excessive emojis
  /([\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]){5,}/u,
  
  // All caps (shouting)
  /^[A-Z\s]{20,}$/,
];

// Auto-Filter function for reviews
export interface FilterResult {
  isFiltered: boolean;
  reason?: string;
}

export function autoFilterReview(review: Review): FilterResult {
  const text = review.text.trim();
  
  // Check for empty or very short reviews
  if (text.length < 3) {
    return { isFiltered: true, reason: 'Too short' };
  }
  
  // Check against spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { isFiltered: true, reason: 'Matches spam pattern' };
    }
  }
  
  // Check for excessive repetition
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 10 && uniqueWords.size < words.length * 0.3) {
    return { isFiltered: true, reason: 'Excessive repetition' };
  }
  
  // Transparency: Negative reviews are NOT filtered (preserve trust)
  // Only filter actual spam/junk, not negative sentiment
  
  return { isFiltered: false };
}

// Moderation for B2B Control
export interface ModerationPermission {
  canModerate: boolean;
  canRespond: boolean;
  canEdit: boolean;
}

export function getModerationPermissions(brandPlan: 'standard' | 'premium'): ModerationPermission {
  if (brandPlan === 'premium') {
    return {
      canModerate: true,
      canRespond: true,
      canEdit: true
    };
  }
  
  // Standard: Read-only
  return {
    canModerate: false,
    canRespond: false,
    canEdit: false
  };
}
