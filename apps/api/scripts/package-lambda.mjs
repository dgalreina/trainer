// Prepara lambda-dist/: el JS que emite `nest build` (tsc) más sus dependencias de
// producción. No se empaqueta con esbuild: envuelve `mongoose` en una copia con solo
// getters y `@nestjs/mongoose` acaba fallando con "Cannot set property
// nextConnectionId ... only a getter".
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const out = "lambda-dist";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
cpSync("dist", `${out}/dist`, { recursive: true });

// @trainer/shared es un paquete del workspace: se empaqueta y se instala como tarball.
const tgz = execSync("npm pack ../../packages/shared --pack-destination " + out, {
  encoding: "utf8",
}).trim().split("\n").pop();

const dependencies = { ...pkg.dependencies, "@trainer/shared": `file:./${tgz}` };
writeFileSync(
  `${out}/package.json`,
  JSON.stringify({ private: true, type: "module", dependencies }),
);

execSync("npm install --omit=dev --no-audit --no-fund --ignore-scripts", {
  cwd: out,
  stdio: "inherit",
});
