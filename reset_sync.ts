import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

const configPath = "./firebase-applet-config.json";
if (fs.existsSync(configPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  
  setDoc(doc(db, "config", "global"), { lastSync: 0 }, { merge: true }).then(() => {
    console.log("Reset lastSync");
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
