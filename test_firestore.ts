import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
console.log("Firebase Config:", firebaseConfig);

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function testFirestore() {
  try {
    console.log("Testing Firestore connection...");
    
    // Test write to config
    console.log("Writing to config/global...");
    await setDoc(doc(db, "config", "global"), { 
      lastSync: new Date().toISOString(),
      test: "test-value"
    }, { merge: true });
    console.log("✓ Write successful");
    
    // Test read from config
    console.log("Reading from config/global...");
    const docSnap = await getDoc(doc(db, "config", "global"));
    if (docSnap.exists()) {
      console.log("✓ Read successful, data:", docSnap.data());
    } else {
      console.log("✗ Document does not exist");
    }
    
    // Test write to discounts
    console.log("Writing to discounts/test...");
    await setDoc(doc(db, "discounts", "test"), {
      id: "test",
      title: "Test Discount",
      store: "Test Store",
      createdAt: new Date().toISOString(),
      isVerified: true
    });
    console.log("✓ Write to discounts successful");
    
    // Test read from discounts
    console.log("Reading from discounts/test...");
    const discountSnap = await getDoc(doc(db, "discounts", "test"));
    if (discountSnap.exists()) {
      console.log("✓ Read successful, data:", discountSnap.data());
    } else {
      console.log("✗ Document does not exist");
    }
    
  } catch (error) {
    console.error("✗ Firestore error:", error);
  }
}

testFirestore();
