import { BadRequestException } from "@nestjs/common";

/** Lee una fecha ISO de la URL; un valor ilegible es un error del cliente, no un "sin filtro". */
export function parseQueryDate(value: string | undefined, name: string): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(`«${name}» no es una fecha válida`);
  return date;
}
