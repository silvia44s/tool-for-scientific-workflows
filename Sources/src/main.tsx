/**
 * @file main.tsx
 * @brief Application entry point responsible for bootstrapping the React application.
 *
 * This file initializes the React root and renders the main App component
 * into the DOM. It also enables React Strict Mode for additional runtime checks
 * during development.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
