// Local in-memory database as fallback when Firebase is not available

interface LocalData {
  discounts: Record<string, any>;
  malls: Record<string, any>;
  config: Record<string, any>;
  reviews: Record<string, any>;
  brands: Record<string, any>;
  flashDiscounts: Record<string, any>;
  triggers: Record<string, any>;
  userLocations: Record<string, any>;
}

class LocalDatabase {
  private data: LocalData = {
    discounts: {},
    malls: {},
    config: {},
    reviews: {},
    brands: {},
    flashDiscounts: {},
    triggers: {},
    userLocations: {}
  };

  // Discounts
  async getDiscounts(limit: number = 50): Promise<any[]> {
    return Object.values(this.data.discounts)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async setDiscount(id: string, data: any): Promise<void> {
    this.data.discounts[id] = { ...data, id };
  }

  async getDiscount(id: string): Promise<any | null> {
    return this.data.discounts[id] || null;
  }

  // Malls
  async getMalls(): Promise<any[]> {
    return Object.values(this.data.malls);
  }

  async setMall(id: string, data: any): Promise<void> {
    this.data.malls[id] = { ...data, id };
  }

  async getMall(id: string): Promise<any | null> {
    return this.data.malls[id] || null;
  }

  // Config
  async getConfig(key: string = 'global'): Promise<any> {
    return this.data.config[key] || {};
  }

  async setConfig(key: string, data: any): Promise<void> {
    this.data.config[key] = data;
  }

  // Reviews
  async getReviews(discountId: string): Promise<any[]> {
    return Object.values(this.data.reviews)
      .filter(r => r.discountId === discountId && !r.isFiltered);
  }

  async setReview(id: string, data: any): Promise<void> {
    this.data.reviews[id] = { ...data, id };
  }

  // Brands
  async getBrandsByPlan(plan: string): Promise<any[]> {
    return Object.values(this.data.brands).filter(b => b.plan === plan);
  }

  async setBrand(id: string, data: any): Promise<void> {
    this.data.brands[id] = { ...data, id };
  }

  async getBrand(id: string): Promise<any | null> {
    return this.data.brands[id] || null;
  }

  // Flash Discounts
  async getActiveFlashDiscounts(mallId: string): Promise<any[]> {
    const now = new Date().toISOString();
    return Object.values(this.data.flashDiscounts)
      .filter(d => d.mallId === mallId && d.isActive && d.validUntil > now);
  }

  async setFlashDiscount(id: string, data: any): Promise<void> {
    this.data.flashDiscounts[id] = { ...data, id };
  }

  async deactivateFlashDiscount(id: string): Promise<void> {
    if (this.data.flashDiscounts[id]) {
      this.data.flashDiscounts[id].isActive = false;
    }
  }

  // Triggers
  async setTrigger(id: string, data: any): Promise<void> {
    this.data.triggers[id] = { ...data, id };
  }

  // User Locations
  async setUserLocation(id: string, data: any): Promise<void> {
    this.data.userLocations[id] = { ...data, id };
  }

  // Scratch Codes (in Brand data)
  async validateScratchCode(brandId: string, code: string): Promise<boolean> {
    const brand = this.data.brands[brandId];
    if (!brand || brand.plan !== 'premium') return false;
    return brand.scratchCodes?.includes(code) || false;
  }

  async useScratchCode(brandId: string, code: string): Promise<boolean> {
    const brand = this.data.brands[brandId];
    if (!brand || brand.plan !== 'premium') return false;
    const codes = brand.scratchCodes || [];
    const index = codes.indexOf(code);
    if (index > -1) {
      codes.splice(index, 1);
      this.data.brands[brandId].scratchCodes = codes;
      return true;
    }
    return false;
  }
}

export const localDb = new LocalDatabase();
