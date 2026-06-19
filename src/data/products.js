// Shared product catalog — the single source of truth for selectable products.
// Used by the Create Order form's product picker (and available to any view
// that needs to list products). `price` is numeric so totals can be computed.
export const products = [
  { id: 1, name: 'NVIDIA GeForce RTX 4090 Founders Edition', sku: 'NV-RTX4090-FE', category: 'Graphics Cards', price: 1599.0 },
  { id: 2, name: 'NVIDIA RTX 4070 Founders Edition', sku: 'NV-4070-FE', category: 'Graphics Cards', price: 599.0 },
  { id: 3, name: 'Intel Core i9-14900K Processor', sku: 'INT-I9-14900K', category: 'Processors', price: 589.0 },
  { id: 4, name: 'Intel Core i7-13700K', sku: 'INT-13700K', category: 'Processors', price: 399.0 },
  { id: 5, name: 'ASUS ROG Maximus Z790 Dark Hero', sku: 'AS-MAX-Z790', category: 'Motherboards', price: 699.0 },
  { id: 6, name: 'Corsair Dominator Platinum 64GB DDR5', sku: 'COR-DP-64G5', category: 'Memory', price: 299.0 },
  { id: 7, name: 'Corsair Vengeance 32GB DDR5', sku: 'COR-32G5', category: 'Memory', price: 89.0 },
  { id: 8, name: 'Samsung 980 Pro 2TB NVMe SSD', sku: 'SAM-980P-2TB', category: 'Storage', price: 179.99 },
  { id: 9, name: 'Samsung 990 Pro 1TB NVMe', sku: 'SAM-990-1T', category: 'Storage', price: 109.0 },
  { id: 10, name: 'Corsair RM1000x 1000W 80+ Gold PSU', sku: 'COR-RM1000X', category: 'Power Supply', price: 199.99 },
]

export function findProduct(id) {
  return products.find((p) => p.id === id) || null
}
