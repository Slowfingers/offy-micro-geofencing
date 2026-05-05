import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from "fs";

const configPath = "./firebase-applet-config.json";
if (fs.existsSync(configPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  
  getDocs(collection(db, "discounts")).then(async snapshot => {
    console.log("Deleting", snapshot.size, "discounts...");
    for (const d of snapshot.docs) {
      await deleteDoc(doc(db, "discounts", d.id));
    }
    console.log("Done");
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
