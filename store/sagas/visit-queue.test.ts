import { ApiError } from '../../services/errors/api-error';
import reducer, { decideMarkFailure, decideMarkSuccess, loadQueueSuccess, queueAvailability } from '../reducers/visit-queue';
import { QUEUE_MESSAGES, toDecisionError } from './visit-queue';

jest.mock('../../services/api', () => ({ visitControlApi: {} }));
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mark = (id: string) => ({
  id,
  status: 'IN' as const,
  childName: 'Мария Иванова',
  representativeId: 'mother',
  representativeName: 'Иванова А.',
  linkRole: 'PARENT',
  datetime: '2026-10-12T01:40:00.000Z',
  comment: null,
  group: null,
});

describe('visit queue decisions', () => {
  it('explains why a decision was not saved', () => {
    expect(toDecisionError(new ApiError('conflict', 409, '', { code: 'VISIT_ALREADY_DECIDED' })))
      .toBe(QUEUE_MESSAGES.alreadyDecided);
    expect(toDecisionError(new ApiError('forbidden', 403, '', { code: 'SELF_CONFIRMATION' })))
      .toBe(QUEUE_MESSAGES.ownMark);
    expect(toDecisionError(new ApiError('server', 500))).toBe(QUEUE_MESSAGES.generic);
    // 401: интерсептор уже выходит из аккаунта, диалог не нужен
    expect(toDecisionError(new ApiError('unauthorized', 401))).toBeNull();
  });

  it('removes a decided mark from the queue at once and keeps a failed one', () => {
    const loaded = reducer(undefined, loadQueueSuccess({ items: [mark('a'), mark('b')], otherCount: 2 }));

    const decided = reducer(loaded, decideMarkSuccess('a'));
    expect(decided.items.map((item) => item.id)).toEqual(['b']);
    expect(decided.otherCount).toBe(2);

    const failed = reducer(loaded, decideMarkFailure({ id: 'a', message: QUEUE_MESSAGES.network }));
    expect(failed.items).toHaveLength(2);
    expect(failed.error).toBe(QUEUE_MESSAGES.network);
  });

  it('empties the queue when confirmation is switched off in the kindergarten', () => {
    const loaded = reducer(undefined, loadQueueSuccess({ items: [mark('a')], otherCount: 1 }));

    const off = reducer(loaded, queueAvailability(false));

    expect(off.enabled).toBe(false);
    expect(off.items).toEqual([]);
    expect(off.otherCount).toBe(0);
  });
});
