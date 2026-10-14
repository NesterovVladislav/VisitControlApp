import { ApiError } from '@/services/errors/api-error';
import reducer, {
  cancelChildRequestFinished,
  decideChildRequestFinished,
  loadOwnChildRequestsSuccess,
  loadPendingChildRequestsSuccess,
} from '@/store/reducers/child-requests';
import { CHILD_REQUEST_MESSAGES, toChildRequestError } from '@/store/sagas/child-requests';
import { ChildRequest } from '@/store/types/child-requests';
import {
  applicantLabel,
  canAddChild,
  childRequestSummary,
  matchOptionLabel,
  ownRequestStatusLabel,
} from './child-requests';

jest.mock('@/services/api', () => ({ visitControlApi: {} }));

const request = (id: string): ChildRequest => ({
  id,
  status: 'PENDING',
  surname: 'Иванов',
  firstName: 'Петя',
  patronymic: null,
  birthDate: '2021-03-12',
  gender: 'MALE',
  applicantName: 'Иванова А.',
  applicantRole: 'PARENT',
  matches: [{ id: 'k1', surname: 'Иванов', firstName: 'Пётр', patronymic: null, birthDate: '2021-03-12' }],
});

describe('add a child from the profile', () => {
  it('is available to everyone in a kindergarten, staff included', () => {
    expect(['PARENT', 'EMPLOYEE', 'ADMIN', 'DIRECTOR'].every(canAddChild)).toBe(true);
    expect(canAddChild('TECH_ADMIN')).toBe(false);
    expect(canAddChild(null)).toBe(false);
  });

  it('builds the labels', () => {
    expect(childRequestSummary(request('r1'))).toBe('Иванов Петя · 12.03.2021');
    expect(applicantLabel(request('r1'))).toBe('Иванова А. · Родитель');
    expect(matchOptionLabel(request('r1').matches[0])).toBe('Уже в саду: Иванов Пётр, 12.03.2021');
    expect(ownRequestStatusLabel({ status: 'PENDING' })).toBe('Ждёт подтверждения сада');
    expect(ownRequestStatusLabel({ status: 'REJECTED' })).toBe('Сад не добавил ребёнка');
  });

  it('explains refusals of the server in plain words', () => {
    expect(toChildRequestError(new ApiError('conflict', 409, '', { code: 'CHILD_REQUEST_EXISTS' })))
      .toBe(CHILD_REQUEST_MESSAGES.exists);
    expect(toChildRequestError(new ApiError('conflict', 409, '', { code: 'CHILD_ALREADY_LINKED' })))
      .toBe(CHILD_REQUEST_MESSAGES.linked);
    expect(toChildRequestError(new ApiError('conflict', 409, '', { code: 'ALREADY_PROCESSED' })))
      .toBe(CHILD_REQUEST_MESSAGES.alreadyDecided);
    expect(toChildRequestError(new ApiError('bad', 400))).toBe(CHILD_REQUEST_MESSAGES.invalid);
    expect(toChildRequestError(new ApiError('unauthorized', 401))).toBeNull();
  });

  it('removes a decided or cancelled request and keeps it when the server refused', () => {
    const admin = reducer(undefined, loadPendingChildRequestsSuccess([request('r1'), request('r2')]));
    expect(reducer(admin, decideChildRequestFinished({ id: 'r1', message: null })).pending.map((item) => item.id))
      .toEqual(['r2']);
    const refused = reducer(admin, decideChildRequestFinished({ id: 'r1', message: 'Заявку уже рассмотрели' }));
    expect(refused.pending).toHaveLength(2);
    expect(refused.error).toBe('Заявку уже рассмотрели');

    const own = reducer(undefined, loadOwnChildRequestsSuccess([request('r1')]));
    expect(reducer(own, cancelChildRequestFinished({ id: 'r1', message: null })).own).toEqual([]);
  });
});
