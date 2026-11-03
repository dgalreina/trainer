import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marca un endpoint como accesible sin token (por defecto todos lo exigen). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
