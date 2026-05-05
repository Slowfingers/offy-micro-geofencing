import { Brand, FlashDiscount, PlanType } from '../types/mall';
import { localDb } from './localDatabase.ts';

export class B2BService {
  // Brand Management
  static async createBrand(brand: Omit<Brand, 'id' | 'createdAt' | 'updatedAt'>): Promise<Brand> {
    const id = brand.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const now = new Date().toISOString();

    const newBrand: Brand = {
      id,
      ...brand,
      createdAt: now,
      updatedAt: now
    };

    await localDb.setBrand(id, newBrand);
    return newBrand;
  }

  static async getBrand(id: string): Promise<Brand | null> {
    return await localDb.getBrand(id);
  }

  static async getBrandsByPlan(plan: PlanType): Promise<Brand[]> {
    const brands = await localDb.getBrandsByPlan(plan);
    return brands.filter(b => b.plan === plan);
  }

  static async updateBrand(id: string, updates: Partial<Brand>): Promise<void> {
    const brand = await localDb.getBrand(id);
    if (brand) {
      await localDb.setBrand(id, {
        ...brand,
        ...updates,
        updatedAt: new Date().toISOString()
      });
    }
  }

  // Flash Discounts (Premium only)
  static async createFlashDiscount(discount: Omit<FlashDiscount, 'id' | 'createdAt'>): Promise<FlashDiscount> {
    const id = 'flash-' + Date.now();
    const now = new Date().toISOString();

    const newDiscount: FlashDiscount = {
      id,
      ...discount,
      createdAt: now
    };

    await localDb.setFlashDiscount(id, newDiscount);
    return newDiscount;
  }

  static async getActiveFlashDiscounts(mallId: string): Promise<FlashDiscount[]> {
    return await localDb.getActiveFlashDiscounts(mallId);
  }

  static async deactivateFlashDiscount(id: string): Promise<void> {
    await localDb.deactivateFlashDiscount(id);
  }

  // Scratch to Win (Premium only)
  static async validateScratchCode(brandId: string, code: string): Promise<boolean> {
    return await localDb.validateScratchCode(brandId, code);
  }

  static async addScratchCode(brandId: string, code: string): Promise<void> {
    const brand = await localDb.getBrand(brandId);
    if (!brand || brand.plan !== 'premium') return;

    const codes = brand.scratchCodes || [];
    if (!codes.includes(code)) {
      codes.push(code);
      await localDb.setBrand(brandId, { ...brand, scratchCodes: codes });
    }
  }

  static async useScratchCode(brandId: string, code: string): Promise<boolean> {
    return await localDb.useScratchCode(brandId, code);
  }
}
