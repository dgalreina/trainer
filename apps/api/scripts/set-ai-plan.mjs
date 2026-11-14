// Pone el plan de IA de un usuario: node --env-file=.env scripts/set-ai-plan.mjs <email|userId> <gratis|prueba|pro>
// El plan manda el servidor (la app no puede cambiarlo). Hasta que exista RevenueCat se pone a mano con este script.
import { execFileSync } from "node:child_process";
import mongoose from "mongoose";

const [who, plan] = process.argv.slice(2);
if (!who || !["gratis", "prueba", "pro"].includes(plan)) {
  console.error("Uso: node --env-file=.env scripts/set-ai-plan.mjs <email|userId> <gratis|prueba|pro>");
  process.exit(1);
}

// Con un email se busca su `sub` de Cognito (es el userId de toda la app).
let userId = who;
if (who.includes("@")) {
  const out = execFileSync(
    "aws",
    ["cognito-idp", "admin-get-user", "--user-pool-id", process.env.COGNITO_USER_POOL_ID, "--username", who, "--region", "eu-west-1", "--output", "json"],
    { encoding: "utf8" },
  );
  userId = JSON.parse(out).UserAttributes.find((a) => a.Name === "sub").Value;
}

await mongoose.connect(process.env.MONGODB_URI);
await mongoose.connection.db.collection("settings").updateOne({ userId }, { $set: { aiPlan: plan } }, { upsert: true });
console.log(`Plan de IA de ${userId}: ${plan}`);
await mongoose.disconnect();
