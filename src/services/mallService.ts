import { Mall, Discount } from '../types/mall';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, getDoc, limit } from "firebase/firestore";

export class MallService {
  private static readonly COLLECTION = 'malls';
  private static readonly DISCOUNTS_COLLECTION = 'discounts';

  static async createMall(mall: Omit<Mall, 'id' | 'createdAt' | 'updatedAt'>): Promise<Mall> {
    const id = mall.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const now = new Date().toISOString();
    
    const newMall: Mall = {
      id,
      ...mall,
      createdAt: now,
      updatedAt: now
    };
    
    await setDoc(doc(db, this.COLLECTION, id), newMall);
    return newMall;
  }

  static async getMall(id: string): Promise<Mall | null> {
    const docSnap = await getDoc(doc(db, this.COLLECTION, id));
    if (!docSnap.exists()) return null;
    return docSnap.data() as Mall;
  }

  static async getAllMalls(): Promise<Mall[]> {
    const q = query(collection(db, this.COLLECTION), orderBy('name'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Mall);
  }

  static async updateMall(id: string, updates: Partial<Mall>): Promise<void> {
    await setDoc(doc(db, this.COLLECTION, id), {
      ...updates,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  static async deleteMall(id: string): Promise<void> {
    // Note: Firestore doesn't have delete, you'd need to use deleteDoc
    // For now, we'll mark as inactive or implement proper delete
  }

  // Get TOP-1 discount for a specific mall
  static async getTopDiscount(mallId: string): Promise<Discount | null> {
    const q = query(
      collection(db, this.DISCOUNTS_COLLECTION),
      where('mallId', '==', mallId),
      where('isVerified', '==', true),
      orderBy('priority', 'desc'),
      orderBy('createdAt', 'desc'),
      // Note: Firestore requires composite index for multiple orderBy
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    
    const discount = querySnapshot.docs[0].data() as Discount;
    return discount;
  }

  // Get all discounts for a mall
  static async getMallDiscounts(mallId: string): Promise<Discount[]> {
    const q = query(
      collection(db, this.DISCOUNTS_COLLECTION),
      where('mallId', '==', mallId),
      where('isVerified', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as Discount);
  }

  // Set discount as top offer for a mall
  static async setTopOffer(discountId: string, mallId: string): Promise<void> {
    // Reset all other discounts for this mall
    const allDiscounts = await this.getMallDiscounts(mallId);
    
    for (const discount of allDiscounts) {
      await setDoc(doc(db, this.DISCOUNTS_COLLECTION, discount.id), {
        isTopOffer: discount.id === discountId,
        priority: discount.id === discountId ? 100 : 0
      }, { merge: true });
    }
  }
}
