import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OrganizationBrand, OrganizationState } from '../types/organization';

const initialState: OrganizationState = {
  brand: null,
};

const organizationSlice = createSlice({
  name: 'organization',
  initialState,
  reducers: {
    /** При выходе не сбрасывается: экран входа показывает сад последнего входа. */
    brandLoaded: (state, action: PayloadAction<OrganizationBrand>) => {
      state.brand = action.payload;
    },
  },
});

export const { brandLoaded } = organizationSlice.actions;

export default organizationSlice.reducer;
