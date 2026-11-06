import type { FoodCategory } from '@trainer/shared';

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  carne: 'Carne',
  pescado: 'Pescado',
  huevos: 'Huevos',
  lacteos: 'Lácteos',
  cereales: 'Cereales',
  legumbres: 'Legumbres',
  verduras: 'Verduras',
  frutas: 'Frutas',
  frutos_secos: 'Frutos secos',
  grasas: 'Grasas',
  dulces: 'Dulces',
  bebidas: 'Bebidas',
  suplementos: 'Suplementos',
  otros: 'Otros',
};

export const FOOD_CATEGORY_LIST = Object.keys(FOOD_CATEGORY_LABELS) as FoodCategory[];
