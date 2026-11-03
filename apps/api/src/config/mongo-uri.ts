import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

let cached: Promise<string> | undefined;

/**
 * URI de MongoDB. En local sale de `MONGODB_URI` (.env). En Lambda sale de un
 * parámetro SecureString de SSM (`MONGODB_URI_PARAM`), para no dejar la
 * contraseña en claro en las variables de entorno de la función.
 * Se pide una vez por instancia y se reutiliza entre invocaciones.
 */
export function getMongoUri(): Promise<string> {
  cached ??= resolveMongoUri();
  return cached;
}

async function resolveMongoUri(): Promise<string> {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;

  const name = process.env.MONGODB_URI_PARAM;
  if (!name) throw new Error("Falta MONGODB_URI o MONGODB_URI_PARAM");

  const out = await new SSMClient({}).send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );
  const value = out.Parameter?.Value;
  if (!value) throw new Error(`El parámetro ${name} está vacío`);
  return value;
}
