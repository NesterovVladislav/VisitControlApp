import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PhotoRequest, PhotosState, PhotoTarget } from '../types/photos';

const initialState: PhotosState = {
  own: [],
  pending: [],
  busyUserIds: [],
  cancellingIds: [],
  decidingIds: [],
  error: null,
};

function without(list: string[], id: string): string[] {
  return list.filter((item) => item !== id);
}

const photosSlice = createSlice({
  name: 'photos',
  initialState,
  reducers: {
    loadOwnPhotoRequests: () => {},
    loadOwnPhotoRequestsSuccess: (state, action: PayloadAction<PhotoRequest[]>) => {
      state.own = action.payload;
    },
    /** uri — квадратный JPEG на устройстве, см. services/photos/pick-photo.ts */
    submitPhotoStart: (state, action: PayloadAction<PhotoTarget & { uri: string }>) => {
      state.busyUserIds.push(action.payload.userId);
      state.error = null;
    },
    deletePhotoStart: (state, action: PayloadAction<PhotoTarget>) => {
      state.busyUserIds.push(action.payload.userId);
      state.error = null;
    },
    /** Отправка или удаление закончились; error — что показать пользователю. */
    photoFinished: (state, action: PayloadAction<{ userId: string; error?: string }>) => {
      state.busyUserIds = without(state.busyUserIds, action.payload.userId);
      state.error = action.payload.error ?? null;
    },
    cancelPhotoRequestStart: (state, action: PayloadAction<string>) => {
      state.cancellingIds.push(action.payload);
      state.error = null;
    },
    cancelPhotoRequestFinished: (state, action: PayloadAction<{ id: string; error?: string }>) => {
      state.cancellingIds = without(state.cancellingIds, action.payload.id);
      state.error = action.payload.error ?? null;
      if (!action.payload.error) {
        state.own = state.own.filter((request) => request.id !== action.payload.id);
      }
    },
    /** silent — фоновое обновление числа на вкладке «Заявки» */
    loadPendingPhotoRequests: (_state, _action: PayloadAction<{ silent?: boolean } | undefined>) => {},
    loadPendingPhotoRequestsSuccess: (state, action: PayloadAction<PhotoRequest[]>) => {
      state.pending = action.payload;
    },
    approvePhotoRequestStart: (state, action: PayloadAction<string>) => {
      state.decidingIds.push(action.payload);
      state.error = null;
    },
    rejectPhotoRequestStart: (state, action: PayloadAction<{ id: string; comment: string }>) => {
      state.decidingIds.push(action.payload.id);
      state.error = null;
    },
    /** Решение принято или заявку уже решил другой администратор: из списка она уходит в обоих случаях. */
    decidePhotoRequestFinished: (state, action: PayloadAction<{ id: string; error?: string; keep?: boolean }>) => {
      state.decidingIds = without(state.decidingIds, action.payload.id);
      state.error = action.payload.error ?? null;
      if (!action.payload.keep) {
        state.pending = state.pending.filter((request) => request.id !== action.payload.id);
      }
    },
    clearPhotoError: (state) => {
      state.error = null;
    },
  },
});

export const {
  loadOwnPhotoRequests,
  loadOwnPhotoRequestsSuccess,
  submitPhotoStart,
  deletePhotoStart,
  photoFinished,
  cancelPhotoRequestStart,
  cancelPhotoRequestFinished,
  loadPendingPhotoRequests,
  loadPendingPhotoRequestsSuccess,
  approvePhotoRequestStart,
  rejectPhotoRequestStart,
  decidePhotoRequestFinished,
  clearPhotoError,
} = photosSlice.actions;

export default photosSlice.reducer;
