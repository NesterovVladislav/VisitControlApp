/**
 * Сад для шапки и экрана входа: название и логотип (GET /organization/current).
 */
export interface OrganizationBrand {
  id: string;
  name: string;
  /** Полный адрес картинки; null — логотипа нет */
  logoUrl: string | null;
}

export interface OrganizationState {
  /** Сад текущего пользователя, а после выхода — сад последнего входа на этом устройстве */
  brand: OrganizationBrand | null;
}
