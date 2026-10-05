import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { servicesAPI } from '../services/api';

export const fetchServices = createAsyncThunk(
  'services/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const res = await servicesAPI.list(params);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در دریافت خدمات');
    }
  }
);

export const createService = createAsyncThunk(
  'services/create',
  async (data, { rejectWithValue }) => {
    try {
      const res = await servicesAPI.create(data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در ایجاد خدمت');
    }
  }
);

export const updateService = createAsyncThunk(
  'services/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await servicesAPI.update(id, data);
      return res.data;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در ویرایش خدمت');
    }
  }
);

export const deleteService = createAsyncThunk(
  'services/delete',
  async (id, { rejectWithValue }) => {
    try {
      await servicesAPI.delete(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || 'خطا در حذف خدمت');
    }
  }
);

const servicesSlice = createSlice({
  name: 'services',
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchServices.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchServices.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchServices.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(createService.fulfilled, (state, action) => { state.list.push(action.payload); })
      .addCase(updateService.fulfilled, (state, action) => {
        const idx = state.list.findIndex(s => s.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteService.fulfilled, (state, action) => {
        state.list = state.list.filter(s => s.id !== action.payload);
      });
  }
});

export default servicesSlice.reducer;
