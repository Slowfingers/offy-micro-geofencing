import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import fs from "fs";
import { scrapeAndParseFallback } from "./scraper.ts";
import { isPointInPolygon, evaluateSmartPushTrigger } from "./src/services/geolocation.ts";
import { MallService } from "./src/services/mallService.ts";
import { autoFilterReview, getModerationPermissions } from "./src/services/moderationService.ts";
import { B2BService } from "./src/services/b2bService.ts";
import type { Mall, UserLocation, SmartPushTrigger, Review, Brand, FlashDiscount } from "./src/types/mall.ts";

dotenv.config();

// Suppress harmless Firestore idle stream warnings
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes("CANCELLED: Disconnecting idle stream")) {
    return;
  }
  originalConsoleError(...args);
};

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes

// Mall Management Routes
app.get("/api/malls", async (req, res) => {
  try {
    const malls = await MallService.getAllMalls();
    res.json(malls);
  } catch (error) {
    console.error("Error fetching malls:", error);
    res.status(500).json({ error: "Failed to fetch malls" });
  }
});

app.get("/api/malls/:id", async (req, res) => {
  try {
    const mall = await MallService.getMall(req.params.id);
    if (!mall) return res.status(404).json({ error: "Mall not found" });
    res.json(mall);
  } catch (error) {
    console.error("Error fetching mall:", error);
    res.status(500).json({ error: "Failed to fetch mall" });
  }
});

app.post("/api/malls", async (req, res) => {
  try {
    const mall = await MallService.createMall(req.body);
    res.json(mall);
  } catch (error) {
    console.error("Error creating mall:", error);
    res.status(500).json({ error: "Failed to create mall" });
  }
});

app.put("/api/malls/:id", async (req, res) => {
  try {
    await MallService.updateMall(req.params.id, req.body);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error updating mall:", error);
    res.status(500).json({ error: "Failed to update mall" });
  }
});

// Get TOP-1 discount for a mall
app.get("/api/malls/:id/top-discount", async (req, res) => {
  try {
    const discount = await MallService.getTopDiscount(req.params.id);
    if (!discount) return res.status(404).json({ error: "No discounts found for this mall" });
    res.json(discount);
  } catch (error) {
    console.error("Error fetching top discount:", error);
    res.status(500).json({ error: "Failed to fetch top discount" });
  }
});

// Set discount as top offer
app.post("/api/malls/:mallId/top-offer/:discountId", async (req, res) => {
  try {
    await MallService.setTopOffer(req.params.discountId, req.params.mallId);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error setting top offer:", error);
    res.status(500).json({ error: "Failed to set top offer" });
  }
});

// Geolocation Routes
app.post("/api/check-location", async (req, res) => {
  try {
    const { lat, lng, mallId } = req.body;
    const malls = mallId ? [await MallService.getMall(mallId)] : await MallService.getAllMalls();
    
    const results = [];
    for (const mall of malls) {
      if (!mall) continue;
      const isInside = isPointInPolygon({ lat, lng }, mall.polygon);
      if (isInside) {
        results.push({
          mallId: mall.id,
          mallName: mall.name,
          isInside: true
        });
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error("Error checking location:", error);
    res.status(500).json({ error: "Failed to check location" });
  }
});

// Smart Push Trigger Evaluation
app.post("/api/evaluate-trigger", async (req, res) => {
  try {
    const { userId, lat, lng, velocity, dwellTime, mallId } = req.body;
    
    // Check if inside polygon
    const mall = await MallService.getMall(mallId);
    if (!mall) return res.status(404).json({ error: "Mall not found" });
    
    const insidePolygon = isPointInPolygon({ lat, lng }, mall.polygon);
    
    // Evaluate trigger
    const triggerResult = evaluateSmartPushTrigger({
      velocity: velocity || 0,
      dwellTime: dwellTime || 0,
      insidePolygon
    });
    
    // If trigger should fire, get top discount
    let topDiscount = null;
    if (triggerResult.shouldTrigger) {
      topDiscount = await MallService.getTopDiscount(mallId);
    }
    
    // Save trigger event
    if (triggerResult.shouldTrigger) {
      await setDoc(doc(db, "triggers", `${userId}-${mallId}-${Date.now()}`), {
        userId,
        mallId,
        triggeredAt: new Date().toISOString(),
        velocity,
        dwellTime,
        insidePolygon,
        discountId: topDiscount?.id
      } as SmartPushTrigger);
    }
    
    res.json({
      ...triggerResult,
      topDiscount
    });
  } catch (error) {
    console.error("Error evaluating trigger:", error);
    res.status(500).json({ error: "Failed to evaluate trigger" });
  }
});

// User location tracking
app.post("/api/user-location", async (req, res) => {
  try {
    const { userId, lat, lng, velocity, accuracy } = req.body;
    
    await setDoc(doc(db, "userLocations", `${userId}-${Date.now()}`), {
      userId,
      lat,
      lng,
      velocity,
      accuracy,
      timestamp: new Date().toISOString()
    } as UserLocation);
    
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error saving user location:", error);
    res.status(500).json({ error: "Failed to save user location" });
  }
});

// Review System with Smart Moderation
app.post("/api/reviews", async (req, res) => {
  try {
    const { userId, discountId, mallId, rating, text } = req.body;
    
    const reviewId = `review-${Date.now()}`;
    const now = new Date().toISOString();
    
    const review: Review = {
      id: reviewId,
      userId,
      discountId,
      mallId,
      rating,
      text,
      createdAt: now,
      updatedAt: now,
      isVerified: true,
      isFiltered: false
    };
    
    // Auto-filter using Smart Moderation
    const filterResult = autoFilterReview(review);
    if (filterResult.isFiltered) {
      review.isFiltered = true;
      review.filterReason = filterResult.reason;
    }
    
    await setDoc(doc(db, "reviews", reviewId), review);
    
    res.json({ 
      ...review, 
      moderation: filterResult 
    });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

app.get("/api/reviews/:discountId", async (req, res) => {
  try {
    const reviewsRef = collection(db, "reviews");
    const q = query(reviewsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const reviews = querySnapshot.docs
      .map(doc => doc.data() as Review)
      .filter(r => r.discountId === req.params.discountId && !r.isFiltered);
    
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// B2B Brand Management
app.post("/api/brands", async (req, res) => {
  try {
    const brand = await B2BService.createBrand(req.body);
    res.json(brand);
  } catch (error) {
    console.error("Error creating brand:", error);
    res.status(500).json({ error: "Failed to create brand" });
  }
});

app.get("/api/brands/:id", async (req, res) => {
  try {
    const brand = await B2BService.getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    
    // Include moderation permissions
    const permissions = getModerationPermissions(brand.plan);
    res.json({ ...brand, permissions });
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({ error: "Failed to fetch brand" });
  }
});

app.get("/api/brands/plan/:plan", async (req, res) => {
  try {
    const brands = await B2BService.getBrandsByPlan(req.params.plan as 'standard' | 'premium');
    res.json(brands);
  } catch (error) {
    console.error("Error fetching brands by plan:", error);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

// Flash Discounts (Premium only)
app.post("/api/flash-discounts", async (req, res) => {
  try {
    const discount = await B2BService.createFlashDiscount(req.body);
    res.json(discount);
  } catch (error) {
    console.error("Error creating flash discount:", error);
    res.status(500).json({ error: "Failed to create flash discount" });
  }
});

app.get("/api/flash-discounts/:mallId", async (req, res) => {
  try {
    const discounts = await B2BService.getActiveFlashDiscounts(req.params.mallId);
    res.json(discounts);
  } catch (error) {
    console.error("Error fetching flash discounts:", error);
    res.status(500).json({ error: "Failed to fetch flash discounts" });
  }
});

app.delete("/api/flash-discounts/:id", async (req, res) => {
  try {
    await B2BService.deactivateFlashDiscount(req.params.id);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error deactivating flash discount:", error);
    res.status(500).json({ error: "Failed to deactivate flash discount" });
  }
});

// Scratch to Win (Premium only)
app.post("/api/scratch/validate", async (req, res) => {
  try {
    const { brandId, code } = req.body;
    const isValid = await B2BService.validateScratchCode(brandId, code);
    res.json({ isValid });
  } catch (error) {
    console.error("Error validating scratch code:", error);
    res.status(500).json({ error: "Failed to validate scratch code" });
  }
});

app.post("/api/scratch/use", async (req, res) => {
  try {
    const { brandId, code } = req.body;
    const success = await B2BService.useScratchCode(brandId, code);
    res.json({ success });
  } catch (error) {
    console.error("Error using scratch code:", error);
    res.status(500).json({ error: "Failed to use scratch code" });
  }
});

// Premium Priority Push (within mall radius)
app.post("/api/evaluate-trigger-premium", async (req, res) => {
  try {
    const { userId, lat, lng, velocity, dwellTime, mallId, brandId } = req.body;
    
    // Check if brand is Premium
    const brand = brandId ? await B2BService.getBrand(brandId) : null;
    const isPremium = brand?.plan === 'premium';
    
    // Check if inside polygon
    const mall = await MallService.getMall(mallId);
    if (!mall) return res.status(404).json({ error: "Mall not found" });
    
    const insidePolygon = isPointInPolygon({ lat, lng }, mall.polygon);
    
    // Evaluate trigger
    const triggerResult = evaluateSmartPushTrigger({
      velocity: velocity || 0,
      dwellTime: dwellTime || 0,
      insidePolygon
    });
    
    // Get discount - prioritize Premium Flash discounts if applicable
    let topDiscount = null;
    if (triggerResult.shouldTrigger) {
      if (isPremium && insidePolygon) {
        // Premium: check Flash discounts first
        const flashDiscounts = await B2BService.getActiveFlashDiscounts(mallId);
        if (flashDiscounts.length > 0) {
          topDiscount = flashDiscounts[0];
        } else {
          topDiscount = await MallService.getTopDiscount(mallId);
        }
      } else {
        topDiscount = await MallService.getTopDiscount(mallId);
      }
    }
    
    // Save trigger event with priority flag
    if (triggerResult.shouldTrigger) {
      await setDoc(doc(db, "triggers", `${userId}-${mallId}-${Date.now()}`), {
        userId,
        mallId,
        brandId,
        triggeredAt: new Date().toISOString(),
        velocity,
        dwellTime,
        insidePolygon,
        discountId: topDiscount?.id,
        isPremiumPriority: isPremium && insidePolygon
      } as SmartPushTrigger & { isPremiumPriority?: boolean });
    }
    
    res.json({
      ...triggerResult,
      topDiscount,
      isPremiumPriority: isPremium && insidePolygon
    });
  } catch (error) {
    console.error("Error evaluating premium trigger:", error);
    res.status(500).json({ error: "Failed to evaluate premium trigger" });
  }
});

app.get("/api/discounts", async (req, res) => {
  try {
    const discountsRef = collection(db, "discounts");
    const q = query(discountsRef, orderBy("createdAt", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    const discounts = querySnapshot.docs.map(doc => doc.data());
    res.json(discounts);
  } catch (error) {
    console.error("Error fetching discounts from Firestore:", error);
    res.status(500).json({ error: "Failed to fetch discounts" });
  }
});

app.post("/api/update-sync-time", async (req, res) => {
  try {
    await setDoc(doc(db, "config", "global"), { lastSync: new Date().toISOString() }, { merge: true });
    res.json({ status: "success" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update sync time" });
  }
});

app.get("/api/raw-posts", async (req, res) => {
  const channels = [
    "korzinkauz", "urban_vans", "just2010", "newyorkeruzz", "just2010_uz", "terrapro",
    "makromarket_uz", "havasuz", "texnomart", "mediapark_uzb", "lcwaikiki_uzbekistan", "defacto_uzbekistan", "koton_uzbekistan"
  ];
  const rawPosts = [];

  for (const channel of channels) {
    try {
      const url = `https://t.me/s/${channel}`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const posts = $(".tgme_widget_message_wrap");

      posts.slice(-10).each((i, post) => {
        const text = $(post).find(".tgme_widget_message_text").text().trim();
        const postId = $(post).find(".tgme_widget_message").attr("data-post") || Math.random().toString(36).substr(2, 9);
        
        let photo = "";
        const photoStyle = $(post).find(".tgme_widget_message_photo_wrap").attr("style");
        if (photoStyle) photo = photoStyle.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || "";
        
        if (text) {
          rawPosts.push({ id: postId, text, image: photo, source: `https://t.me/${channel}/${postId.split('/')[1] || postId}` });
        }
      });
    } catch (error) {
      console.error(`Error scraping ${channel}:`, error);
    }
  }
  res.json(rawPosts);
});

app.post("/api/save-discounts", async (req, res) => {
  const { discounts } = req.body;
  try {
    for (const discount of discounts) {
      await setDoc(doc(db, "discounts", discount.id), {
        ...discount,
        isVerified: true,
        createdAt: discount.createdAt || new Date().toISOString()
      }, { merge: true });
    }
    await setDoc(doc(db, "config", "global"), { lastSync: new Date().toISOString() }, { merge: true });
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error saving discounts:", error);
    res.status(500).json({ error: "Failed to save discounts" });
  }
});

app.post("/api/scrape-fallback", async (req, res) => {
  try {
    const discounts = await scrapeAndParseFallback();
    await setDoc(doc(db, "config", "global"), { lastSync: new Date().toISOString() }, { merge: true });
    res.json({ status: "success", count: discounts.length });
  } catch (error) {
    console.error("Fallback scraper error:", error);
    res.status(500).json({ error: "Fallback scraper failed" });
  }
});

app.get("/api/image", async (req, res) => {
  try {
    const postUrl = req.query.url as string;
    if (!postUrl) return res.status(400).send("No url");
    const embedUrl = postUrl + "?embed=1&mode=tme";
    const response = await axios.get(embedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 5000
    });
    const $ = cheerio.load(response.data);
    let photoStyle = $(".tgme_widget_message_photo_wrap").attr("style");
    if (!photoStyle) {
      photoStyle = $(".tgme_widget_message_video_thumb").attr("style");
    }
    if (photoStyle) {
      const imageMatch = photoStyle.match(/url\(['"]?(.*?)['"]?\)/);
      if (imageMatch && imageMatch[1]) {
        try {
          const imageRes = await axios.get(imageMatch[1], { responseType: "stream" });
          res.set("Content-Type", imageRes.headers["content-type"]);
          res.set("Cache-Control", "public, max-age=86400");
          return imageRes.data.pipe(res);
        } catch (e) {
          // Fall through
        }
      }
    }
    // Fallback if no photo found or image fetch failed
    res.redirect(`https://picsum.photos/seed/${encodeURIComponent(postUrl)}/600/400`);
  } catch (error) {
    res.redirect(`https://picsum.photos/seed/${encodeURIComponent(String(req.query.url || 'error'))}/600/400`);
  }
});

app.get("/api/config", async (req, res) => {
  try {
    const configRef = doc(db, "config", "global");
    const configSnap = await getDocs(query(collection(db, "config")));
    const globalConfig = configSnap.docs.find(d => d.id === "global")?.data();
    res.json(globalConfig || {});
  } catch (error) {
    res.json({});
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Start background scraper interval
    setInterval(async () => {
      console.log("Running hourly scraper via setInterval...");
      try {
        const discounts = await scrapeAndParseFallback();
        console.log(`Hourly scraper finished, saved ${discounts.length} discounts.`);
        await setDoc(doc(db, "config", "global"), { lastSync: new Date().toISOString() }, { merge: true });
      } catch (error) {
        console.error("Hourly scraper error:", error);
      }
    }, 60 * 60 * 1000);
  });
}

startServer();
