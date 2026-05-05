import axios from "axios";
import * as cheerio from "cheerio";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

dotenv.config();

// Load Firebase Config safely
let db: any;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  }
} catch (e) {
  console.error("Could not initialize Firebase in scraper:", e);
}

const CHANNELS = [
  { id: "korzinkauz", name: "Korzinka", category: "Food" },
  { id: "urban_vans", name: "Urban", category: "Clothing" },
  { id: "just2010", name: "Just", category: "Clothing" },
  { id: "newyorkeruzz", name: "New Yorker", category: "Clothing" },
  { id: "terrapro", name: "Terra Pro", category: "Clothing" },
  { id: "makromarket_uz", name: "Makro", category: "Food" },
  { id: "havasuz", name: "Havas", category: "Food" },
  { id: "texnomart", name: "Texnomart", category: "Electronics" },
  { id: "mediapark_uzb", name: "Mediapark", category: "Electronics" },
  { id: "lcwaikiki_uzbekistan", name: "LC Waikiki", category: "Clothing" },
  { id: "defacto_uzbekistan", name: "DeFacto", category: "Clothing" },
  { id: "koton_uzbekistan", name: "Koton", category: "Clothing" }
];

export async function scrapeAndParseFallback() {
  console.log("Starting fallback regex scraper...");
  const discounts = [];

  for (const channel of CHANNELS) {
    try {
      console.log(`Scraping ${channel.name}...`);
      const url = `https://t.me/s/${channel.id}`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000
      });
      
      const $ = cheerio.load(response.data);
      const posts = $(".tgme_widget_message_wrap");

      posts.slice(-15).each((i, post) => {
        const text = $(post).find(".tgme_widget_message_text").text().trim();
        const postId = $(post).find(".tgme_widget_message").attr("data-post") || Math.random().toString(36).substr(2, 9);
        
        if (!text) return;

        const lowerText = text.toLowerCase();

        // Stricter discount check
        const hasDiscountKeyword = /(скидк|chegirm|sale|акци|aksiya|arzon|shok|выгод|1\+1|2\+1|2=1|3=2|-50%|\b\d{2}%\b)/.test(lowerText);
        const hasPercentageOff = /-\d{1,2}%/.test(text) || /\d{1,2}%/.test(text);
        const isNotJustMaterial = !/(100%\s*(хлопок|cotton|paxta|poliester|sifat|качество))/.test(lowerText);

        if ((hasDiscountKeyword || hasPercentageOff) && isNotJustMaterial) {
          // Regex for discount amount
          const discountMatch = text.match(/(?:до|gacha|-)?\s*(\d{1,2}%|100%)/i);
          const comboMatch = text.match(/(1\+1|2\+1|2=1|3=2)/i);
          const priceMatch = text.match(/\b\d{1,3}(?:[\s.,]\d{3})*\s*(?:sum|so'm|сум|uzs)\b/i);
          
          let discountAmount = "Sale";
          if (discountMatch) {
            discountAmount = discountMatch[0].trim();
          } else if (comboMatch) {
            discountAmount = comboMatch[0].trim();
          } else if (priceMatch) {
             discountAmount = priceMatch[0].trim();
          }

          // Regex for date
          const dateMatch = text.match(/(?:до|gacha)\s*(\d{1,2}(?:\.\d{2}|\s*[а-яА-Яa-zA-Z]+(?: \d{4})?))/i);
          const validUntil = dateMatch ? dateMatch[1] : "";

          // Title
          // Remove hashtags and extra spaces
          let cleanText = text.replace(/#\w+/g, '').replace(/https?:\/\/\S+/g, '').trim();
          let title = cleanText.split('\n')[0].trim();
          if (title.length > 60) title = title.substring(0, 56) + "...";

          // Image
          let image = "";
          const photoStyle = $(post).find(".tgme_widget_message_photo_wrap").attr("style");
          if (photoStyle) image = photoStyle.match(/url\(['"]?(.*?)['"]?\)/)?.[1] || "";
          if (!image) image = `https://picsum.photos/seed/${channel.id}/600/400`;

          const discountObj = {
            id: postId.replace('/', '_'),
            store: channel.name,
            discountAmount,
            title: title || channel.name + " Offer",
            description: cleanText,
            category: channel.category,
            image,
            source: `https://t.me/${channel.id}/${postId.split('/')[1] || postId}`,
            validUntil,
            createdAt: new Date().toISOString(),
            isVerified: false, // Indicates regex parsed
            mallId: null, // Will be assigned when linking to a mall
            isTopOffer: false,
            priority: 0
          };

          discounts.push(discountObj);
        }
      });
    } catch (error: any) {
      console.error(`Error scraping ${channel.name}:`, error.message);
    }
  }

  console.log(`Found ${discounts.length} discounts via regex fallback.`);

  if (db) {
    let savedCount = 0;
    for (const discount of discounts) {
      try {
        await setDoc(doc(db, "discounts", discount.id), discount, { merge: true });
        savedCount++;
      } catch (e) {
        console.error("Error saving discount:", e);
      }
    }
    console.log(`Successfully saved ${savedCount} discounts to database.`);
  }
  
  return discounts;
}

// Run if called directly from CLI
if (process.argv[1] && process.argv[1].endsWith("scraper.ts")) {
  scrapeAndParseFallback().then(() => {
    console.log("Fallback scraper finished.");
    process.exit(0);
  });
}
