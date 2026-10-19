import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { invoicesAPI } from '../services/api';

export const fetchInvoices = createAsyncThunk(
  'invoices/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await invoicesAPI.list(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در دریافت فاکتورها');
    }
  }
);

export const createInvoice = createAsyncThunk(
  'invoices/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await invoicesAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در ثبت فاکتور');
    }
  }
);

export const updateInvoice = createAsyncThunk(
  'invoices/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await invoicesAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در ویرایش فاکتور');
    }
  }
);

export const markInvoicePaid = createAsyncThunk(
  'invoices/markPaid',
  async (id, { rejectWithValue }) => {
    try {
      await invoicesAPI.markPaid(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا');
    }
  }
);

export const cancelInvoice = createAsyncThunk(
  'invoices/cancel',
  async (id, { rejectWithValue }) => {
    try {
      await invoicesAPI.cancel(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا');
    }
  }
);

export const deleteInvoice = createAsyncThunk(
  'invoices/delete',
  async (id, { rejectWithValue }) => {
    try {
      await invoicesAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در حذف فاکتور');
    }
  }
);

const invoicesSlice = createSlice({
  name: 'invoices',
  initialState: {
    list: [],
    count: 0,
    currentPage: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (state, action) => {
        const page = Number(action.meta.arg?.page || 1);
        state.loading = page <= 1;
        state.loadingMore = page > 1;
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        if (Array.isArray(action.payload)) {
          state.list = action.payload;
          state.count = action.payload.length;
          state.currentPage = 0;
          state.hasMore = false;
          return;
        }
        const page = Number(action.meta.arg?.page || 1);
        const results = action.payload?.results || [];
        state.list = page > 1
          ? [...state.list, ...results.filter(item => !state.list.some(existing => existing.id === item.id))]
          : results;
        state.count = action.payload?.count || 0;
        state.currentPage = page;
        state.hasMore = Boolean(action.payload?.next);
      })
      .addCase(fetchInvoices.rejected, (state, action) => { state.loading = false; state.loadingMore = false; state.error = action.payload; })
      .addCase(createInvoice.fulfilled, (state, action) => { state.list.unshift(action.payload); })
      .addCase(updateInvoice.fulfilled, (state, action) => {
        const idx = state.list.findIndex(i => i.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(markInvoicePaid.fulfilled, (state, action) => {
        const inv = state.list.find(i => i.id === action.payload);
        if (inv) inv.status = 'paid';
      })
      .addCase(cancelInvoice.fulfilled, (state, action) => {
        const inv = state.list.find(i => i.id === action.payload);
        if (inv) inv.status = 'cancelled';
      })
      .addCase(deleteInvoice.fulfilled, (state, action) => {
        state.list = state.list.filter(i => i.id !== action.payload);
      });
  }
});

export default invoicesSlice.reducer;
