import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChildLinkResult, ChildLinkState, LinkChildPayload } from '../types/child-link';
import { Person } from '../types/people';
import { logoutCompleted } from './auth';

const initialState: ChildLinkState = {
  adult: null,
  q: '',
  candidates: [],
  status: 'idle',
  requestId: 0,
  link: null,
};

/**
 * Шторка «Привязать ребёнка» во вкладке «Люди» администратора.
 */
const childLinkSlice = createSlice({
  name: 'childLink',
  initialState,
  reducers: {
    openChildLink: (state, action: PayloadAction<Person>) => {
      return { ...initialState, adult: action.payload, status: 'loading', requestId: state.requestId + 1 };
    },
    searchLinkCandidates: (state, action: PayloadAction<string>) => {
      state.q = action.payload;
      state.status = 'loading';
      state.requestId += 1;
    },
    linkCandidatesLoaded: (state, action: PayloadAction<{ requestId: number; items: Person[] }>) => {
      if (action.payload.requestId !== state.requestId) {
        return;
      }
      state.candidates = action.payload.items;
      state.status = 'loaded';
    },
    linkCandidatesFailed: (state, action: PayloadAction<{ requestId: number }>) => {
      if (action.payload.requestId === state.requestId) {
        state.status = 'failed';
      }
    },
    /** Администратор подтвердил привязку; пока идёт одна, вторую не начинаем. */
    linkChild: (state, action: PayloadAction<LinkChildPayload>) => {
      if (!state.adult || state.link?.status === 'pending') {
        return;
      }
      state.link = { childId: action.payload.child.id, status: 'pending', message: null };
    },
    linkChildFinished: (state, action: PayloadAction<ChildLinkResult>) => {
      if (state.link?.childId === action.payload.childId) {
        state.link = action.payload;
      }
    },
    /** Результат привязки показан. */
    clearChildLinkResult: (state) => {
      if (state.link?.status !== 'pending') {
        state.link = null;
      }
    },
    closeChildLink: (state) => {
      if (state.link?.status !== 'pending') {
        return { ...initialState, requestId: state.requestId + 1 };
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(logoutCompleted, () => initialState);
  },
});

export const {
  openChildLink,
  searchLinkCandidates,
  linkCandidatesLoaded,
  linkCandidatesFailed,
  linkChild,
  linkChildFinished,
  clearChildLinkResult,
  closeChildLink,
} = childLinkSlice.actions;
export default childLinkSlice.reducer;
