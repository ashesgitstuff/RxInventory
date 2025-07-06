"use client";

import { useEffect } from 'react';

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
    };
  }
}

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    const isElectronApp = typeof window !== 'undefined' && window.electron?.isElectron;

    // Only register the service worker if not in an Electron app
    if (!isElectronApp && 'serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      });
    }
  }, []);

  return null;
};

export default ServiceWorkerRegistration;
