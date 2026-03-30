import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/styles/ios-liquid-glass.css';
import { prepareNativeWebRuntime } from './services/nativeRuntimeService';

// Suppress "MeshBVH: 'maxLeafTris' option has been deprecated" warning
// This comes from the interaction between three-bvh-csg and three-mesh-bvh
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('maxLeafTris')) return;
  originalWarn(...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

void prepareNativeWebRuntime();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
