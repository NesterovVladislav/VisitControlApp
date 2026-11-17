import { LinkRole, Person } from './people';
import { LoadStatus } from './visits';

/**
 * Привязка ребёнка к взрослому из «Людей»: поиск среди детей сада (GET /user/people) и
 * POST /child-representative. 'linked' — связь создана, 'failed' — нет, причина в message.
 */
export interface ChildLinkResult {
  childId: string;
  status: 'pending' | 'linked' | 'failed';
  message: string | null;
}

export interface ChildLinkState {
  /** Взрослый, к которому привязываем; null — шторка закрыта */
  adult: Person | null;
  q: string;
  candidates: Person[];
  status: LoadStatus;
  /** Номер поиска: ответ на устаревший запрос отбрасывается */
  requestId: number;
  link: ChildLinkResult | null;
}

export interface LinkChildPayload {
  child: Person;
  linkRole: LinkRole;
}
