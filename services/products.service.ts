import { productsMock } from '@/mocks/products.mock';
import { readStoredList, writeStoredList } from '@/lib/storage';
import type { CreateProductDTO, Product, UpdateProductDTO } from '@/types/product';

const STORAGE_KEY = 'neqta-products';
const readProducts = () => readStoredList(STORAGE_KEY, productsMock);
const persist = (products: Product[]) => { writeStoredList(STORAGE_KEY, products); return products; };

export interface ProductsService {
  list(): Promise<Product[]>; getById(id: string): Promise<Product | null>;
  create(dto: CreateProductDTO): Promise<Product>; update(id: string, dto: UpdateProductDTO): Promise<Product>;
  save(product: Product): Promise<Product>;
  remove(id: string): Promise<void>;
}

export const productsService: ProductsService = {
  async list() { return structuredClone(readProducts()); },
  async getById(id) { return structuredClone(readProducts().find((product) => product.id === id) ?? null); },
  async create(dto) {
    const product: Product = { id: globalThis.crypto?.randomUUID?.() ?? `produto-${Date.now()}`, name: dto.name, category: dto.category, variableCost: 0, currentPrice: dto.currentPrice, projectedMargin: 0, targetMargin: dto.targetMargin, recommendedPrice: dto.currentPrice, status: 'warning', kind: dto.kind ?? 'product' };
    persist([...readProducts(), product]);
    return structuredClone(product);
  },
  async update(id, dto) {
    const products = readProducts();
    const index = products.findIndex((product) => product.id === id);
    if (index < 0) throw new Error('Produto não encontrado');
    const updated = { ...products[index], ...dto };
    products[index] = updated;
    persist(products);
    return structuredClone(updated);
  },
  async save(product) {
    const products = readProducts();
    const index = products.findIndex((item) => item.id === product.id);
    if (index >= 0) products[index] = product; else products.push(product);
    persist(products);
    return structuredClone(product);
  },
  async remove(id) { persist(readProducts().filter((product) => product.id !== id)); },
};
