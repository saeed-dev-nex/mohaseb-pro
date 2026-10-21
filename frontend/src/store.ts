import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';

// Stage 8: customers/services/invoices server state moved to TanStack
// Query (see src/hooks/); Redux now holds session/UI state only.
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
