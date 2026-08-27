import { storeCollection } from '@/services/store-records.service';
import type { Promotion } from '@/types/promotion';

export const promotionsService = storeCollection<Promotion>('promotions');

export type PromotionDismissal = {
  id: string;
  dismissedAt: string;
};

export const promotionDismissalsService =
  storeCollection<PromotionDismissal>('promotion-dismissals');
