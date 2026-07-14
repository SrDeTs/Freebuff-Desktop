import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/app.css'
import { createElectronStub } from './lib/electron-stub'

// Bootstrap the Freebuff API bridge (Tauri or mock)
if (!window.freebuff) {
  // createElectronStub is async — it detects Tauri vs browser
  createElectronStub().then((api) => {
    window.freebuff = api
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  })
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
