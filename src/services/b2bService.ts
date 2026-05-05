import { Brand, FlashDiscount, PlanType } from '../types/mall';
import { collection, doc, setDoc, getDocs, query, where, getDoc } from "firebase/firestore";
import { db } from '../firebase';

export class B2BService {
  private static readonly BRANDS_COLLECTION = 'brands';
  private static readonly FLASH_DISCOUNTS_COLLECTION = 'flashDiscounts';

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
    
    await setDoc(doc(db, this.BRANDS_COLLECTION, id), newBrand);
    return newBrand;
  }

  static async getBrand(id: string): Promise<Brand | null> {
    const docSnap = await getDoc(doc(db, this.BRANDS_COLLECTION, id));
    if (!docSnap.exists()) return null;
    return docSnap.data() as Brand;
  }

  static async getBrandsByPlan(plan: PlanType): Promise<Brand[]> {
    const q = query(collection(db, this.BRANDS_COLLECTION), where('plan', '==', plan));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Brand);
  }

  static async updateBrand(id: string, updates: Partial<Brand>): Promise<void> {
    await setDoc(doc(db, this.BRANDS_COLLECTION, id), {
      ...updates,
      updatedAt: new Date().toISOString()
    }, { merge: true });
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
    
    await setDoc(doc(db, this.FLASH_DISCOUNTS_COLLECTION, id), newDiscount);
    return newDiscount;
  }

  static async getActiveFlashDiscounts(mallId: string): Promise<FlashDiscount[]> {
    const now = new Date().toISOString();
    const q = query(
      collection(db, this.FLASH_DISCOUNTS_COLLECTION),
      where('mallId', '==', mallId),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const discounts = querySnapshot.docs.map(doc => doc.data() as FlashDiscount);
    
    // Filter by validUntil
    return discounts.filter(d => d.validUntil > now);
  }

  static async deactivateFlashDiscount(id: string): Promise<void> {
    await setDoc(doc(db, this.FLASH_DISCOUNTS_COLLECTION, id), {
      isActive: false
    }, { merge: true });
  }

  // Scratch to Win (Premium only)
  static async validateScratchCode(brandId: string, code: string): Promise<boolean> {
    const brand = await this.getBrand(brandId);
    if (!brand || brand.plan !== 'premium') return false;
    
    return brand.scratchCodes?.includes(code) || false;
  }

  static async addScratchCode(brandId: string, code: string): Promise<void> {
    const brand = await this.getBrand(brandId);
    if (!brand || brand.plan !== 'premium') return;
    
    const codes = brand.scratchCodes || [];
    if (!codes.includes(code)) {
      codes.push(code);
      await this.updateBrand(brandId, { scratchCodes: codes });
    }
  }

  static async useScratchCode(brandId: string, code: string): Promise<boolean> {
    const brand = await this.getBrand(brandId);
    if (!brand || brand.plan !== 'premium') return false;
    
    const codes = brand.scratchCodes || [];
    const index = codes.indexOf(code);
    if (index > -1) {
      codes.splice(index, 1);
      await this.updateBrand(brandId, { scratchCodes: codes });
      return true;
    }
    
    return false;
  }
}
