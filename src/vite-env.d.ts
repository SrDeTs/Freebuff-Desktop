/// <reference types="vite/client" />

import type { FreebuffAPI } from './lib/electron-stub'

declare global {
  interface Window {
    freebuff: FreebuffAPI
  }
}

export {}
