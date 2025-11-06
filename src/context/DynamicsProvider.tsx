import React, { useState, useEffect } from 'react';
import { DynamicsContext, DynamicsContextType } from './DynamicsContext';
import { ILauncherContext } from '../models/types';

// Helper to create a fallback context for local development
const getLocalDevContext = (): ILauncherContext => {
    return {
        type: "Form",
        entityName: "contact",
        recordIds: ["12345678-ABCD-1234-ABCD-1234567890AB"],
        appIdentifier: "demo",
        userSettings: {
            userId: "local-dev-user-guid",
            userName: "Local Dev User"
        }
    };
};

export const DynamicsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userName, setUserName] = useState<string>('Connecting...');
    const [userGuid, setUserGuid] = useState<string>('Loading...');
    const [launcherContext, setLauncherContext] = useState<ILauncherContext | null>(null);

    useEffect(() => {
        const setContextData = (contextData: any) => {
            const processedContext: ILauncherContext = { ...(contextData.launcherContext || contextData) };
            const userSettings = contextData.userSettings || processedContext.userSettings;

            // Set user info
            if (userSettings) {
                setUserName(String(userSettings.userName || 'Unknown User'));
                setUserGuid(String(userSettings.userId || 'Unknown GUID'));
            }

            // Handle the selectionKey logic to get full ID list
            if (processedContext.selectionKey && (!processedContext.recordIds || processedContext.recordIds.length === 0)) {
                (async () => {
                    try {
                        const parentIds = await requestIdsFromParent(processedContext.selectionKey);
                        if (parentIds.length > 0) {
                            processedContext.recordIds = parentIds;
                            processedContext.totalRecordCount = parentIds.length;
                            processedContext.selectedRecordCount = parentIds.length;
                        }
                    } finally {
                        setLauncherContext(processedContext);
                    }
                })();
            } else {
                setLauncherContext(processedContext);
            }
        };

        // 1. Try to get context from URL
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('data');

        if (dataParam) {
            try {
                const decoded = decodeURIComponent(dataParam);
                const parsedContext = JSON.parse(decoded);
                setContextData(parsedContext);
            } catch (e) {
                console.error("Failed to parse context from URL", e);
            }
        } 
        // 2. Try to get context from parent window message (for debuggers)
        else {
            const handleMessage = (event: MessageEvent) => {
                if (event.data && event.data.type === "D365_CONTEXT") {
                    setContextData(event.data.context);
                    window.removeEventListener("message", handleMessage); // Only handle once
                }
            };
            window.addEventListener("message", handleMessage);

            // 3. Fallback to local dev context if not in an iframe
            if (window.self === window.top) {
                setTimeout(() => {
                    if (!launcherContext) {
                        console.warn("Running in local dev mode. Using fallback context.");
                        setContextData(getLocalDevContext());
                    }
                }, 500);
            }

            // 4. Send "ready" message to parent
            try {
                window.parent.postMessage("react-app-ready", "*");
            } catch (e) {
                // cross-origin, ignore
            }
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    // Function to ask parent for full selection list
    const requestIdsFromParent = (key: string | undefined): Promise<string[]> => {
        return new Promise((resolve) => {
            if (!key || !window.parent) return resolve([]);

            const listener = (ev: MessageEvent) => {
                try {
                    const data = ev.data;
                    if (data && data.type === 'docgen_response_selection' && data.key === key && Array.isArray(data.ids)) {
                        window.removeEventListener('message', listener);
                        resolve(data.ids.map((id: any) => String(id).replace(/[{}]/g, '')));
                    }
                } catch (e) { /* ignore */ }
            };

            window.addEventListener('message', listener);

            try {
                window.parent.postMessage({ type: 'docgen_request_selection', key }, '*');
            } catch (e) { /* ignore */ }

            // Timeout after 2.5s
            setTimeout(() => {
                window.removeEventListener('message', listener);
                resolve([]);
            }, 2500);
        });
    };

    const value: DynamicsContextType = { userName, userGuid, launcherContext };

    return (
        <DynamicsContext.Provider value={value}>
            {children}
        </DynamicsContext.Provider>
    );
};