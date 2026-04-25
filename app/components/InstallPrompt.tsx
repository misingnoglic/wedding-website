"use client";

import { useState, useEffect } from "react";

export default function InstallPrompt() {
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Register service worker if needed
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch((err) => {
                    console.log('ServiceWorker registration failed: ', err);
                });
            });
        }

        // Check if user already dismissed the prompt
        if (localStorage.getItem("installPromptDismissed") === "true") {
            return;
        }

        // Check if already installed
        const isAppInstalled = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
        if (isAppInstalled) {
            setIsStandalone(true);
            return;
        }

        // iOS detection
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        if (isIosDevice) {
            // Show prompt for iOS right away since they don't get beforeinstallprompt event
            setShowPrompt(true);
        }

        // Chrome/Android detection (beforeinstallprompt is fired)
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setShowPrompt(true);
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        // Listen for successful install
        const handleAppInstalledEvent = () => {
            setIsStandalone(true);
            setShowPrompt(false);
        };
        window.addEventListener("appinstalled", handleAppInstalledEvent);

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
            window.removeEventListener("appinstalled", handleAppInstalledEvent);
        };
    }, []);

    if (!showPrompt || isStandalone) return null;

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === "accepted") {
                setShowPrompt(false);
                setDeferredPrompt(null);
            }
        }
    };

    const handleDismiss = () => {
        localStorage.setItem("installPromptDismissed", "true");
        setShowPrompt(false);
    };

    return (
        <div className="fixed bottom-4 left-4 right-4 bg-white p-5 border border-zinc-200 shadow-2xl z-[9999] rounded-xl animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="font-karla font-bold text-lg text-black">A & C Wedding</h3>
                    <p className="text-sm text-zinc-600 font-karla mt-0.5">Install our app for easy access to the itinerary and more!</p>
                </div>
                <button 
                    onClick={handleDismiss} 
                    className="text-zinc-400 hover:text-black transition-colors shrink-0 ml-4 pt-1" 
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <div className="mt-4">
                {isIOS ? (
                    <p className="text-sm text-zinc-600 font-karla flex items-center flex-wrap gap-x-2 gap-y-1">
                        Tap <svg className="h-6 w-6 border rounded-md p-1 bg-zinc-50" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> below and select <strong className="whitespace-nowrap">Add to Home Screen</strong>.
                    </p>
                ) : (
                    <button 
                        onClick={handleInstall} 
                        className="w-full bg-black text-white px-4 py-3 rounded-lg font-karla font-medium hover:bg-zinc-800 transition-colors shadow-sm active:scale-[0.98]"
                    >
                        Install App
                    </button>
                )}
            </div>
        </div>
    );
}
