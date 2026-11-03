// Migra las rutinas sueltas del modelo anterior a entrenamientos. Cada usuario con rutinas y
// sin ningún entrenamiento recibe uno, "Mi entrenamiento", con sus rutinas dentro, y queda
// como el activo. Es repetible (salta a quien ya tiene entrenamientos) y NO borra la
// colección `routines`: queda como copia de seguridad.
//   node --env-file=.env scripts/migrate-routines-to-trainings.mjs
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI");

await mongoose.connect(uri);
const db = mongoose.connection.db;
const now = new Date();
// Día de calendario en Madrid (donde vive el usuario), no el UTC.
const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(now);

const userIds = await db.collection("routines").distinct("userId");
let migrated = 0;

for (const userId of userIds) {
  if (await db.collection("trainings").countDocuments({ userId })) {
    console.log(`  ${userId.slice(0, 8)}…: ya tiene entrenamientos, se salta`);
    continue;
  }
  const routines = await db.collection("routines").find({ userId }).sort({ createdAt: 1 }).toArray();
  const { insertedId } = await db.collection("trainings").insertOne({
    userId,
    name: "Mi entrenamiento",
    startDate: today,
    durationWeeks: 8,
    routines: routines.map((r) => ({ _id: new mongoose.Types.ObjectId(), name: r.name, slots: r.slots })),
    createdAt: now,
    updatedAt: now,
    __v: 0,
  });
  await db.collection("settings").updateOne(
    { userId },
    { $set: { activeTrainingId: String(insertedId) }, $setOnInsert: { activeDietId: null, createdAt: now, __v: 0 }, $currentDate: { updatedAt: true } },
    { upsert: true },
  );
  console.log(`  ${userId.slice(0, 8)}…: ${routines.length} rutina(s) → entrenamiento "Mi entrenamiento" (activo)`);
  migrated++;
}

console.log(`usuarios migrados: ${migrated} de ${userIds.length}`);
await mongoose.disconnect();
