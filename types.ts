export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
}

export interface InventoryItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  quantity: number;
  timestamp: number;
}

export enum AppState {
  DASHBOARD = 'DASHBOARD',
  ADD_ITEM = 'ADD_ITEM',
}

export interface MatchResult {
  matchedProductId: string | null;
  detectedQuantity: number | null;
  suggestions: string[]; // List of Product IDs
}
