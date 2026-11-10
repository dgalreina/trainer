// Carga las plantillas de entrenamiento (training_templates) en MongoDB. Es idempotente: se identifican por
// `key`, así que repetirlo solo actualiza. Comprueba que cada ejercicio exista en el catálogo base.
//   node --env-file=.env scripts/seed-training-templates.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const { exerciseNameKey } = require("@trainer/shared");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI");

const templates = JSON.parse(readFileSync(new URL("../seed/training-templates.base.json", import.meta.url), "utf8"));

await mongoose.connect(uri);
const db = mongoose.connection.db;

// Todos los ejercicios de las plantillas tienen que estar en el catálogo base: si no, «Usar» fallaría.
const base = new Set((await db.collection("exercises").find({ ownerId: null }).toArray()).map((e) => e.nameKey));
const missing = [
  ...new Set(templates.flatMap((t) => t.routines.flatMap((r) => r.slots.map((s) => s.exercise)))),
].filter((name) => !base.has(exerciseNameKey(name)));
if (missing.length > 0) throw new Error(`Faltan en el catálogo base: ${missing.join(", ")} (ejecuta antes el seed de ejercicios)`);

const col = db.collection("training_templates");
const now = new Date();
const result = await col.bulkWrite(
  templates.map(({ key, ...rest }) => ({
    updateOne: {
      filter: { key },
      update: { $set: { ...rest, updatedAt: now }, $setOnInsert: { key, createdAt: now, __v: 0 } },
      upsert: true,
    },
  })),
);
console.log(`plantillas de entrenamiento: ${result.upsertedCount} creadas, ${result.modifiedCount} actualizadas, ${templates.length} en total`);
await mongoose.disconnect();
