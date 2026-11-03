// Carga el catálogo base de ejercicios (ownerId null) en MongoDB. Es idempotente:
// se puede repetir y solo crea o actualiza, nunca borra ni toca los ejercicios de usuarios.
//   node --env-file=.env scripts/seed-exercises.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const { exerciseNameKey } = require("@trainer/shared");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI");

const exercises = JSON.parse(readFileSync(new URL("../seed/exercises.base.json", import.meta.url), "utf8"));

await mongoose.connect(uri);
const col = mongoose.connection.db.collection("exercises");
const now = new Date();

const result = await col.bulkWrite(
  exercises.map(({ name, category }) => ({
    updateOne: {
      filter: { ownerId: null, nameKey: exerciseNameKey(name) },
      update: {
        $set: { name, category, updatedAt: now },
        $setOnInsert: { archived: false, createdAt: now, __v: 0 },
      },
      upsert: true,
    },
  })),
);
console.log(`catálogo base: ${result.upsertedCount} creados, ${result.modifiedCount} actualizados, ${exercises.length} en total`);
await mongoose.disconnect();
