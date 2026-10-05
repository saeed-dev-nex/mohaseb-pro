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
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchInvoices.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchInvoices.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
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
