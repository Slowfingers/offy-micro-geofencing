import express from "express";
import { createServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { localDb } from "./src/services/localDatabase.ts";
import { scrapeAndParseFallback } from "./scraper.ts";
import { isPointInPolygon, evaluateSmartPushTrigger, updateUserLocation, getDwellTime, selectTopDiscount } from "./src/services/geolocation.ts";
import { autoFilterReview, getModerationPermissions } from "./src/services/moderationService.ts";
import { B2BService } from "./src/services/b2bService.ts";
import type { Mall, UserLocation, SmartPushTrigger, Review, Brand, FlashDiscount } from "./src/types/mall.ts";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "dist")));

// Mall Management
app.get("/api/malls", async (req, res) => {
  try {
    const malls = await localDb.getMalls();
    res.json(malls);
  } catch (error) {
    console.error("Error fetching malls:", error);
    res.status(500).json({ error: "Failed to fetch malls" });
  }
});

app.get("/api/malls/:id", async (req, res) => {
  try {
    const mall = await localDb.getMall(req.params.id);
    if (!mall) return res.status(404).json({ error: "Mall not found" });
    res.json(mall);
  } catch (error) {
    console.error("Error fetching mall:", error);
    res.status(500).json({ error: "Failed to fetch mall" });
  }
});

app.post("/api/malls", async (req, res) => {
  try {
    const id = req.body.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const now = new Date().toISOString();
    const mall: Mall = {
      id,
      ...req.body,
      createdAt: now,
      updatedAt: now
    };
    await localDb.setMall(id, mall);
    res.json(mall);
  } catch (error) {
    console.error("Error creating mall:", error);
    res.status(500).json({ error: "Failed to create mall" });
  }
});

app.put("/api/malls/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await localDb.setMall(id, { ...req.body, id, updatedAt: new Date().toISOString() });
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error updating mall:", error);
    res.status(500).json({ error: "Failed to update mall" });
  }
});

// Geolocation
app.post("/api/check-location", async (req, res) => {
  try {
    const { lat, lng, mallId, userId } = req.body;
    const mall = await localDb.getMall(mallId);
    if (!mall) return res.status(404).json({ error: "Mall not found" });

    const location = { lat, lng };
    const insidePolygon = isPointInPolygon(location, mall.polygon);

    // Track dwell time if userId is provided
    let dwellTime = 0;
    let justEntered = false;
    let justExited = false;

    if (userId) {
      const tracking = updateUserLocation(userId, mallId, location, mall.polygon);
      dwellTime = tracking.dwellTime;
      justEntered = tracking.justEntered;
      justExited = tracking.justExited;
    }

    res.json({ insidePolygon, dwellTime, justEntered, justExited });
  } catch (error) {
    console.error("Error checking location:", error);
    res.status(500).json({ error: "Failed to check location" });
  }
});

app.post("/api/evaluate-trigger", async (req, res) => {
  try {
    const { velocity, dwellTime, insidePolygon } = req.body;
    const triggerResult = evaluateSmartPushTrigger({
      velocity: velocity || 0,
      dwellTime: dwellTime || 0,
      insidePolygon
    });
    res.json(triggerResult);
  } catch (error) {
    console.error("Error evaluating trigger:", error);
    res.status(500).json({ error: "Failed to evaluate trigger" });
  }
});

app.post("/api/top-discount", async (req, res) => {
  try {
    const { userLocation, mallId, userPreferences } = req.body;
    const discounts = await localDb.getDiscounts();
    const mall = mallId ? await localDb.getMall(mallId) : null;

    const topDiscount = selectTopDiscount({
      discounts,
      userLocation: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
      mallPolygon: mall?.polygon,
      userPreferences
    });

    res.json(topDiscount);
  } catch (error) {
    console.error("Error selecting top discount:", error);
    res.status(500).json({ error: "Failed to select top discount" });
  }
});

// User location
app.post("/api/user-location", async (req, res) => {
  try {
    const { userId, lat, lng, velocity, accuracy } = req.body;
    const id = `${userId}-${Date.now()}`;
    await localDb.setUserLocation(id, {
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

// Reviews with Smart Moderation
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
    
    const filterResult = autoFilterReview(review);
    if (filterResult.isFiltered) {
      review.isFiltered = true;
      review.filterReason = filterResult.reason;
    }
    
    await localDb.setReview(reviewId, review);
    res.json({ ...review, moderation: filterResult });
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

app.get("/api/reviews/:discountId", async (req, res) => {
  try {
    const reviews = await localDb.getReviews(req.params.discountId);
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// B2B Brands
app.post("/api/brands", async (req, res) => {
  try {
    const id = req.body.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const brand: Brand = {
      id,
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await localDb.setBrand(id, brand);
    res.json(brand);
  } catch (error) {
    console.error("Error creating brand:", error);
    res.status(500).json({ error: "Failed to create brand" });
  }
});

app.get("/api/brands/:id", async (req, res) => {
  try {
    const brand = await localDb.getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: "Brand not found" });
    const permissions = getModerationPermissions(brand.plan);
    res.json({ ...brand, permissions });
  } catch (error) {
    console.error("Error fetching brand:", error);
    res.status(500).json({ error: "Failed to fetch brand" });
  }
});

app.get("/api/brands/plan/:plan", async (req, res) => {
  try {
    const brands = await localDb.getBrandsByPlan(req.params.plan);
    res.json(brands);
  } catch (error) {
    console.error("Error fetching brands by plan:", error);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

// Flash Discounts
app.post("/api/flash-discounts", async (req, res) => {
  try {
    const id = 'flash-' + Date.now();
    const discount: FlashDiscount = {
      id,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    await localDb.setFlashDiscount(id, discount);
    res.json(discount);
  } catch (error) {
    console.error("Error creating flash discount:", error);
    res.status(500).json({ error: "Failed to create flash discount" });
  }
});

app.get("/api/flash-discounts/:mallId", async (req, res) => {
  try {
    const discounts = await localDb.getActiveFlashDiscounts(req.params.mallId);
    res.json(discounts);
  } catch (error) {
    console.error("Error fetching flash discounts:", error);
    res.status(500).json({ error: "Failed to fetch flash discounts" });
  }
});

app.delete("/api/flash-discounts/:id", async (req, res) => {
  try {
    await localDb.deactivateFlashDiscount(req.params.id);
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error deactivating flash discount:", error);
    res.status(500).json({ error: "Failed to deactivate flash discount" });
  }
});

// Scratch to Win
app.post("/api/scratch/validate", async (req, res) => {
  try {
    const { brandId, code } = req.body;
    const isValid = await localDb.validateScratchCode(brandId, code);
    res.json({ isValid });
  } catch (error) {
    console.error("Error validating scratch code:", error);
    res.status(500).json({ error: "Failed to validate scratch code" });
  }
});

app.post("/api/scratch/use", async (req, res) => {
  try {
    const { brandId, code } = req.body;
    const success = await localDb.useScratchCode(brandId, code);
    res.json({ success });
  } catch (error) {
    console.error("Error using scratch code:", error);
    res.status(500).json({ error: "Failed to use scratch code" });
  }
});

// Premium Priority Push
app.post("/api/evaluate-trigger-premium", async (req, res) => {
  try {
    const { userId, lat, lng, velocity, dwellTime, mallId, brandId } = req.body;
    const brand = brandId ? await localDb.getBrand(brandId) : null;
    const isPremium = brand?.plan === 'premium';
    const mall = await localDb.getMall(mallId);
    if (!mall) return res.status(404).json({ error: "Mall not found" });
    const insidePolygon = isPointInPolygon({ lat, lng }, mall.polygon);
    const triggerResult = evaluateSmartPushTrigger({
      velocity: velocity || 0,
      dwellTime: dwellTime || 0,
      insidePolygon
    });
    let topDiscount = null;
    if (triggerResult.shouldTrigger) {
      const discounts = await localDb.getDiscounts(1);
      topDiscount = discounts[0] || null;
    }
    if (triggerResult.shouldTrigger) {
      await localDb.setTrigger(`${userId}-${mallId}-${Date.now()}`, {
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

// Discounts
app.get("/api/discounts", async (req, res) => {
  try {
    const discounts = await localDb.getDiscounts(50);
    res.json(discounts);
  } catch (error) {
    console.error("Error fetching discounts:", error);
    res.status(500).json({ error: "Failed to fetch discounts" });
  }
});

app.post("/api/update-sync-time", async (req, res) => {
  try {
    await localDb.setConfig('global', { lastSync: new Date().toISOString() });
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error updating sync time:", error);
    res.status(500).json({ error: "Failed to update sync time" });
  }
});

app.get("/api/config", async (req, res) => {
  try {
    const config = await localDb.getConfig('global');
    res.json(config);
  } catch (error) {
    res.json({});
  }
});

app.post("/api/save-discounts", async (req, res) => {
  try {
    const { discounts } = req.body;
    for (const discount of discounts) {
      await localDb.setDiscount(discount.id, {
        ...discount,
        isVerified: true,
        createdAt: discount.createdAt || new Date().toISOString()
      });
    }
    await localDb.setConfig('global', { lastSync: new Date().toISOString() });
    res.json({ status: "success" });
  } catch (error) {
    console.error("Error saving discounts:", error);
    res.status(500).json({ error: "Failed to save discounts" });
  }
});

app.post("/api/scrape-fallback", async (req, res) => {
  try {
    const discounts = await scrapeAndParseFallback();
    res.json({ status: "success", count: discounts.length });
  } catch (error) {
    console.error("Error scraping:", error);
    res.status(500).json({ error: "Failed to scrape" });
  }
});

app.get("/api/image", async (req, res) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).json({ error: "URL required" });
    res.redirect(imageUrl);
  } catch (error) {
    res.redirect(`https://picsum.photos/seed/error/600/400`);
  }
});

// Vite dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createServer({
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
    
    setInterval(async () => {
      console.log("Running hourly scraper...");
      try {
        const discounts = await scrapeAndParseFallback();
        console.log(`Hourly scraper finished, saved ${discounts.length} discounts.`);
        await localDb.setConfig('global', { lastSync: new Date().toISOString() });
      } catch (error) {
        console.error("Hourly scraper error:", error);
      }
    }, 60 * 60 * 1000);
  });
}

startServer();
