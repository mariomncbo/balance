import type { IconName } from "../components/Icon";
import type { Category, Source } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  comida: "Comida",
  hogar: "Hogar",
  transporte: "Transporte",
  ocio: "Ocio",
  salud: "Salud",
  compras: "Compras",
  suscripciones: "Suscripciones",
  ingresos: "Nómina e ingresos",
  otros: "Otros",
};
export const CATEGORY_ICON: Record<Category, IconName> = {
  comida: "cart",
  hogar: "home2",
  transporte: "car",
  ocio: "receipt",
  salud: "heart",
  compras: "bag",
  suscripciones: "repeat",
  ingresos: "arrowDown",
  otros: "dots",
};
export const EXPENSE_CATEGORIES: Category[] = [
  "comida",
  "hogar",
  "transporte",
  "ocio",
  "salud",
  "compras",
  "suscripciones",
  "otros",
];
export const SOURCE_LABEL: Record<Source, string> = {
  manual: "",
  ia: "IA",
  ticket: "Ticket",
  atajo: "Atajo",
  fijo: "Fijo",
};

export const ACCOUNT_TYPE_LABEL = {
  banco: "Banco",
  ahorro: "Ahorro",
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  emergencia: "Emergencia",
  empresa: "Empresa",
  otro: "Otro",
} as const;
