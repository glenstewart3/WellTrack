import { createContext, useContext } from 'react';

// In production on admin.welltrack.com.au, SA routes are at / (no prefix).
// In dev/preview, SA routes are at /sa (path-based fallback).
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
const isAdminSubdomain = window.location.hostname === `admin.${BASE_DOMAIN}`;
const SA_BASE = isAdminSubdomain ? '' : '/sa';

const SABasePathCtx = createContext(SA_BASE);

export const useSABasePath = () => useContext(SABasePathCtx);
export const SA_PATH_PREFIX = SA_BASE;
