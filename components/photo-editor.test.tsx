import { fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import PhotoEditor from './photo-editor';
import PhotoRequestsList from './photo-requests-list';
import { ApiError } from '../services/errors/api-error';
import { useAppDispatch, useAppSelector } from '../store';
import reducer, {
  cancelPhotoRequestFinished,
  decidePhotoRequestFinished,
  loadOwnPhotoRequestsSuccess,
  loadPendingPhotoRequestsSuccess,
  photoFinished,
  submitPhotoStart,
} from '../store/reducers/photos';
import { PHOTO_MESSAGES, photoErrorMessage } from '../store/sagas/photos';
import { PhotoRequest, PhotosState } from '../store/types/photos';

jest.mock('../store', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('../services/photos/pick-photo', () => ({
  pickPhoto: jest.fn(),
  PhotoPermissionError: class PhotoPermissionError extends Error {},
}));
jest.mock('../services/auth/auth-token', () => ({ getAuthToken: () => null }));

const mockUseAppDispatch = useAppDispatch as jest.MockedFunction<typeof useAppDispatch>;
const mockUseAppSelector = useAppSelector as jest.MockedFunction<typeof useAppSelector>;

const empty: PhotosState = { own: [], pending: [], busyUserIds: [], cancellingIds: [], decidingIds: [], error: null };

function request(status: PhotoRequest['status'], extra: Partial<PhotoRequest> = {}): PhotoRequest {
  return {
    id: 'r1',
    status,
    userId: 'c1',
    userName: 'Петя Иванов',
    currentPhotoUrl: null,
    imageUrl: status === 'PENDING' ? '/user/photo-requests/r1/image' : null,
    reason: null,
    applicantName: null,
    ...extra,
  };
}

function givenState(photos: Partial<PhotosState>, role = 'PARENT') {
  const dispatch = jest.fn();
  mockUseAppDispatch.mockReturnValue(dispatch);
  mockUseAppSelector.mockImplementation((selector) =>
    selector({ auth: { user: { id: 'u1', role } }, photos: { ...empty, ...photos } } as never),
  );
  return dispatch;
}

function renderEditor(canEdit = true) {
  return render(<PhotoEditor userId="c1" childId="c1" firstName="Петя" surname="Иванов" canEdit={canEdit} />);
}

describe('photo in the profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers a parent to add a photo and says the kindergarten confirms it', async () => {
    const dispatch = givenState({});
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = await renderEditor();

    expect(dispatch).toHaveBeenCalledWith({ type: 'photos/loadOwnPhotoRequests', payload: undefined });
    fireEvent.press(screen.getByText('Добавить фотографию'));

    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Фотография: Петя');
    expect(message).toBe('Новая фотография появится после подтверждения сада');
    // Фотографии ещё нет — убирать нечего
    expect(buttons?.map((button) => button.text)).toEqual(['Сделать снимок', 'Выбрать из галереи', 'Отмена']);
  });

  it('does not promise confirmation to an administrator, who changes the photo at once', async () => {
    givenState({}, 'ADMIN');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = await renderEditor();

    fireEvent.press(screen.getByText('Добавить фотографию'));

    expect(alert.mock.calls[0][1]).toBeUndefined();
  });

  it('shows the waiting request and lets the applicant withdraw it', async () => {
    const dispatch = givenState({ own: [request('PENDING')] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = await renderEditor();

    expect(screen.getByText('Ждёт подтверждения сада')).toBeTruthy();
    expect(screen.queryByText('Добавить фотографию')).toBeNull();
    fireEvent.press(screen.getByText('Отозвать'));
    alert.mock.calls[0][2]?.find((button) => button.text === 'Отозвать')?.onPress?.();

    expect(dispatch).toHaveBeenCalledWith({ type: 'photos/cancelPhotoRequestStart', payload: 'r1' });
  });

  it('shows why the kindergarten rejected the photo and lets the parent try again', async () => {
    givenState({ own: [request('REJECTED', { reason: 'Не видно лица' })] });
    const screen = await renderEditor();

    expect(screen.getByText('Сад отклонил фотографию: Не видно лица')).toBeTruthy();
    expect(screen.getByText('Добавить фотографию')).toBeTruthy();
  });

  it('only shows the photo to a relative', async () => {
    givenState({});
    const screen = await renderEditor(false);

    expect(screen.queryByText('Добавить фотографию')).toBeNull();
  });
});

describe('photo requests of the kindergarten', () => {
  it('shows who sent the photo and lets the administrator decide', async () => {
    const dispatch = givenState({ pending: [request('PENDING', { applicantName: 'Иванова А.' })] }, 'ADMIN');
    const screen = await render(<PhotoRequestsList />);

    expect(screen.getByText('Петя Иванов')).toBeTruthy();
    expect(screen.getByText('Отправил(а): Иванова А.')).toBeTruthy();
    expect(screen.getByText('Сейчас фото нет')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Подтвердить фотографию: Петя Иванов'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'photos/approvePhotoRequestStart', payload: 'r1' });
  });

  it('renders nothing when there are no requests', async () => {
    givenState({}, 'ADMIN');
    const screen = await render(<PhotoRequestsList />);

    expect(screen.toJSON()).toBeNull();
  });
});

describe('photos state', () => {
  it('tracks whose photo is being sent and keeps the error for the user', () => {
    let state = reducer(empty, submitPhotoStart({ userId: 'c1', childId: 'c1', uri: 'file:///photo.jpg' }));
    expect(state.busyUserIds).toEqual(['c1']);

    state = reducer(state, photoFinished({ userId: 'c1', error: PHOTO_MESSAGES.pending }));
    expect(state.busyUserIds).toEqual([]);
    expect(state.error).toBe(PHOTO_MESSAGES.pending);
  });

  it('removes a withdrawn request and a decided one, but keeps a request that failed to be decided', () => {
    let state = reducer(empty, loadOwnPhotoRequestsSuccess([request('PENDING')]));
    state = reducer(state, cancelPhotoRequestFinished({ id: 'r1' }));
    expect(state.own).toEqual([]);

    state = reducer(state, loadPendingPhotoRequestsSuccess([request('PENDING')]));
    state = reducer(state, decidePhotoRequestFinished({ id: 'r1', error: PHOTO_MESSAGES.network, keep: true }));
    expect(state.pending).toHaveLength(1);
    state = reducer(state, decidePhotoRequestFinished({ id: 'r1' }));
    expect(state.pending).toEqual([]);
  });

  it('explains server refusals in plain words', () => {
    const refusal = (status: number, code?: string) =>
      Object.assign(Object.create(ApiError.prototype), {
        status,
        data: code ? { code } : null,
        isNetworkError: false,
        isTimeoutError: false,
      });

    expect(photoErrorMessage(refusal(409, 'PHOTO_CHANGE_PENDING'))).toBe(PHOTO_MESSAGES.pending);
    expect(photoErrorMessage(refusal(400, 'INVALID_PHOTO'))).toBe(PHOTO_MESSAGES.invalid);
    expect(photoErrorMessage(refusal(409, 'ALREADY_PROCESSED'))).toBe(PHOTO_MESSAGES.alreadyDecided);
    expect(photoErrorMessage(refusal(403, 'FORBIDDEN'))).toBe(PHOTO_MESSAGES.notParent);
    expect(photoErrorMessage(new Error('boom'))).toBe(PHOTO_MESSAGES.generic);
  });
});
