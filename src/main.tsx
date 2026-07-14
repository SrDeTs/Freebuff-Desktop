import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/app.css'
import { createElectronStub } from './lib/electron-stub'

// Bootstrap the Electron API stub when running outside Electron
if (!window.freebuff) {
  window.freebuff = createElectronStub()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
