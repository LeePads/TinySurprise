"use client";
import { createContext, useContext } from "react";
export const PreviewSuspendedContext = createContext(false);
export const usePreviewSuspended = () => useContext(PreviewSuspendedContext);
