import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import fs from "fs";

const configPath = "./firebase-applet-config.json";
if (fs.existsSync(configPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  
  getDocs(query(collection(db, "discounts"), limit(5))).then(async snapshot => {
    snapshot.docs.forEach(d => console.log(d.id, d.data().image));
    process.exit(0);
  });
}
