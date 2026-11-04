// Carga el catálogo base de alimentos (ownerId null) en MongoDB. Es idempotente:
// se puede repetir y solo crea o actualiza, nunca borra ni toca los alimentos de usuarios.
//   node --env-file=.env scripts/seed-foods.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");
const { foodNameKey } = require("@trainer/shared");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("Falta MONGODB_URI");

const foods = JSON.parse(readFileSync(new URL("../seed/foods.base.json", import.meta.url), "utf8"));

await mongoose.connect(uri);
const col = mongoose.connection.db.collection("foods");
const now = new Date();

const result = await col.bulkWrite(
  foods.map(({ name, category, kcal, protein, carbs, fat, portions }) => ({
    updateOne: {
      filter: { ownerId: null, nameKey: foodNameKey(name) },
      update: {
        $set: { name, category, kcal, protein, carbs, fat, portions, updatedAt: now },
        $setOnInsert: { archived: false, createdAt: now, __v: 0 },
      },
      upsert: true,
    },
  })),
);
console.log(`catálogo base de alimentos: ${result.upsertedCount} creados, ${result.modifiedCount} actualizados, ${foods.length} en total`);
await mongoose.disconnect();
