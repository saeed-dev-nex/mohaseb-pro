import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/authSlice';
import customersReducer from './features/customersSlice';
import servicesReducer from './features/servicesSlice';
import invoicesReducer from './features/invoicesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    customers: customersReducer,
    services: servicesReducer,
    invoices: invoicesReducer,
  },
});

export default store;
