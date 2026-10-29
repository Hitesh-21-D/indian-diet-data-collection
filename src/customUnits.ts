// Household measures are participant descriptions, not inferred gram weights.
export const customUnits = [
  { value: "bowl", label: "Bowl / katori", step: 0.25 },
  { value: "cup", label: "Cup", step: 0.25 },
  { value: "glass", label: "Glass", step: 0.25 },
  { value: "plate", label: "Plate", step: 0.25 },
  { value: "piece", label: "Piece", step: 1 },
  { value: "slice", label: "Slice", step: 1 },
  { value: "tablespoon", label: "Tablespoon (tbsp)", step: 0.5 },
  { value: "teaspoon", label: "Teaspoon (tsp)", step: 0.5 },
  { value: "serving", label: "Serving", step: 0.25 },
  { value: "g", label: "Grams (g)", step: 10 },
  { value: "ml", label: "Millilitres (ml)", step: 10 },
] as const;

export function quantityLimit(source: string, unit: string) {
  return source === "CUSTOM" && (unit === "g" || unit === "ml") ? 10000 : 100;
}
