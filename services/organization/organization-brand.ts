import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrganizationBrand } from '../../store/types/organization';

export const ORGANIZATION_BRAND_KEY = 'visit-control.organization-brand.v1';

export interface OrganizationBrandStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function isBrand(value: unknown): value is OrganizationBrand {
  if (typeof value !== 'object' || value === null) return false;
  const brand = value as Record<string, unknown>;
  return (
    typeof brand.id === 'string' &&
    typeof brand.name === 'string' &&
    (brand.logoUrl === null || typeof brand.logoUrl === 'string')
  );
}

/**
 * Сад последнего входа на этом устройстве — для логотипа на экране входа. Название и логотип сада открыты
 * и без токена (экран регистрации), поэтому хранятся в обычном хранилище и переживают выход.
 */
export async function loadOrganizationBrand(
  store: OrganizationBrandStore = AsyncStorage
): Promise<OrganizationBrand | null> {
  try {
    const saved = await store.getItem(ORGANIZATION_BRAND_KEY);
    const brand: unknown = saved ? JSON.parse(saved) : null;
    return isBrand(brand) ? brand : null;
  } catch (error) {
    // Не прочиталось — экран входа останется без логотипа
    console.warn('[Organization] Failed to load brand', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

export async function saveOrganizationBrand(
  brand: OrganizationBrand,
  store: OrganizationBrandStore = AsyncStorage
): Promise<void> {
  try {
    await store.setItem(ORGANIZATION_BRAND_KEY, JSON.stringify(brand));
  } catch (error) {
    // Логотип уже показан, не сохранится только для экрана входа
    console.warn('[Organization] Failed to save brand', error instanceof Error ? error.message : 'unknown');
  }
}
