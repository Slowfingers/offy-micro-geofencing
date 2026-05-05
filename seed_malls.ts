import { localDb } from "./src/services/localDatabase.ts";

// Sample malls with approximate polygons for Tashkent
const sampleMalls = [
  {
    name: "Korzinka Mega Planet",
    address: "Tashkent, Uzbekistan",
    polygon: {
      coordinates: [
        { lat: 41.3115, lng: 69.2795 },
        { lat: 41.3115, lng: 69.2815 },
        { lat: 41.3095, lng: 69.2815 },
        { lat: 41.3095, lng: 69.2795 }
      ]
    },
    center: { lat: 41.3105, lng: 69.2805 }
  },
  {
    name: "Samarkand Darvoza",
    address: "Tashkent, Uzbekistan",
    polygon: {
      coordinates: [
        { lat: 41.3190, lng: 69.2400 },
        { lat: 41.3190, lng: 69.2420 },
        { lat: 41.3170, lng: 69.2420 },
        { lat: 41.3170, lng: 69.2400 }
      ]
    },
    center: { lat: 41.3180, lng: 69.2410 }
  },
  {
    name: "Next Tashkent",
    address: "Tashkent, Uzbekistan",
    polygon: {
      coordinates: [
        { lat: 41.3450, lng: 69.2900 },
        { lat: 41.3450, lng: 69.2920 },
        { lat: 41.3430, lng: 69.2920 },
        { lat: 41.3430, lng: 69.2900 }
      ]
    },
    center: { lat: 41.3440, lng: 69.2910 }
  },
  {
    name: "Mega City",
    address: "Tashkent, Uzbekistan",
    polygon: {
      coordinates: [
        { lat: 41.3320, lng: 69.2580 },
        { lat: 41.3320, lng: 69.2600 },
        { lat: 41.3300, lng: 69.2600 },
        { lat: 41.3300, lng: 69.2580 }
      ]
    },
    center: { lat: 41.3310, lng: 69.2590 }
  },
  {
    name: "Sarvar Mall",
    address: "Tashkent, Uzbekistan",
    polygon: {
      coordinates: [
        { lat: 41.3280, lng: 69.2700 },
        { lat: 41.3280, lng: 69.2720 },
        { lat: 41.3260, lng: 69.2720 },
        { lat: 41.3260, lng: 69.2700 }
      ]
    },
    center: { lat: 41.3270, lng: 69.2710 }
  }
];

async function seedMalls() {
  console.log("Seeding malls to local database...");
  
  for (const mall of sampleMalls) {
    const id = mall.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const now = new Date().toISOString();
    
    try {
      await localDb.setMall(id, {
        id,
        ...mall,
        createdAt: now,
        updatedAt: now
      });
      console.log(`✓ Created mall: ${mall.name}`);
    } catch (error) {
      console.error(`✗ Error creating mall ${mall.name}:`, error);
    }
  }
  
  console.log("Seeding complete!");
}

seedMalls().catch(console.error);
