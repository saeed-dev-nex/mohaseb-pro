import { createSlice } from '@reduxjs/toolkit';
import Cookies from 'js-cookie';

// Try to restore stored user info
let storedUser = null;
try {
  const raw = localStorage.getItem('mohaseb_user');
  if (raw) storedUser = JSON.parse(raw);
} catch (_) {}

const initialState = {
  accessToken: Cookies.get('access_token') || null,
  isAuthenticated: !!Cookies.get('access_token'),
  currentUser: storedUser, // { id, username, role, is_superuser, is_staff, ... }
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens: (state, action) => {
      const { access } = action.payload;
      // Use sameSite: 'lax' and no secure flag for LAN HTTP compatibility.
      // The refresh token is NOT stored here anymore: the backend keeps it
      // in an httpOnly cookie that scripts cannot read.
      Cookies.set('access_token', access, { sameSite: 'lax' });
      Cookies.remove('refresh_token'); // clean up tokens stored by older versions
      state.accessToken = access;
      state.isAuthenticated = true;
    },
    setCurrentUser: (state, action) => {
      state.currentUser = action.payload;
      localStorage.setItem('mohaseb_user', JSON.stringify(action.payload));
    },
    logout: (state) => {
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      localStorage.removeItem('mohaseb_user');
      state.accessToken = null;
      state.isAuthenticated = false;
      state.currentUser = null;
    },
  },
});

export const { setTokens, setCurrentUser, logout } = authSlice.actions;
export default authSlice.reducer;
