import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GardenEdit, GardenEditError, GardenState } from '../types/garden';
import { logoutCompleted } from './auth';
import { assignChildSuccess } from './group-people';

const initialState: GardenState = {
  withoutGroupCount: null,
  edit: { status: 'idle', action: null, error: null, createdId: null },
};

/**
 * Вкладка «Сад»: число детей без группы и изменения филиалов и групп. Сами филиалы и группы со счётчиками —
 * в state.visits.present (тот же GET /group/presence), чтобы «Посещение» и «Сад» не расходились.
 */
const gardenSlice = createSlice({
  name: 'garden',
  initialState,
  reducers: {
    loadWithoutGroupCount: () => {},
    loadWithoutGroupCountSuccess: (state, action: PayloadAction<number>) => {
      state.withoutGroupCount = action.payload;
    },

    /** Сохранить или удалить. Пока идёт предыдущее изменение, новое не начинается. */
    startGardenEdit: (state, action: PayloadAction<GardenEdit>) => {
      if (state.edit.status === 'saving') {
        return;
      }
      state.edit = { status: 'saving', action: action.payload, error: null, createdId: null };
    },
    gardenEditSucceeded: (state, action: PayloadAction<{ createdId: string | null }>) => {
      state.edit.status = 'done';
      state.edit.createdId = action.payload.createdId;
    },
    gardenEditFailed: (state, action: PayloadAction<GardenEditError>) => {
      state.edit.status = 'failed';
      state.edit.error = action.payload;
    },
    /** Экран показал результат (закрылся или показал ошибку) */
    resetGardenEdit: (state) => {
      state.edit = initialState.edit;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
    // Ребёнка распределили на экране «Дети без группы»
    builder.addCase(assignChildSuccess, (state) => {
      if (state.withoutGroupCount !== null && state.withoutGroupCount > 0) {
        state.withoutGroupCount -= 1;
      }
    });
  },
});

export const {
  loadWithoutGroupCount,
  loadWithoutGroupCountSuccess,
  startGardenEdit,
  gardenEditSucceeded,
  gardenEditFailed,
  resetGardenEdit,
} = gardenSlice.actions;
export default gardenSlice.reducer;
