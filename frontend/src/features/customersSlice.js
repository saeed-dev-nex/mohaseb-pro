import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { customersAPI } from '../services/api';

export const fetchCustomers = createAsyncThunk(
  'customers/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await customersAPI.list(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در دریافت مشتریان');
    }
  }
);

export const createCustomer = createAsyncThunk(
  'customers/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await customersAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در ایجاد مشتری');
    }
  }
);

export const updateCustomer = createAsyncThunk(
  'customers/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await customersAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در ویرایش مشتری');
    }
  }
);

export const deleteCustomer = createAsyncThunk(
  'customers/delete',
  async (id, { rejectWithValue }) => {
    try {
      await customersAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در حذف مشتری');
    }
  }
);

const customersSlice = createSlice({
  name: 'customers',
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCustomers.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchCustomers.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createCustomer.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        const idx = state.list.findIndex(c => c.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.list = state.list.filter(c => c.id !== action.payload);
      });
  }
});

export default customersSlice.reducer;
