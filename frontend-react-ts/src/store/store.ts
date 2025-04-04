import { configureStore } from '@reduxjs/toolkit';
import flowReducer from './flowSlice';
import viewModeReducer from './viewModeSlice';

export const store = configureStore({
  reducer: {
    flow: flowReducer,
    viewMode: viewModeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 