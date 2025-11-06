/**
 * =================================================================================
 * REACT APP LAUNCHER - Auto-generated on 2025-11-06T15:00:41.202Z
 * =================================================================================
 */

var AppLauncher = (function() {
    'use strict';

    const SUMMARY_THRESHOLD = 100;
    const BASE_PATH = 'prefix_/reactapp';
    const USE_DEBUGGER = false;

    const APP_REGISTRY = {
    };

    function launch(appId, PrimaryControl, SelectedControl, SelectedControlSelectedItemIds) {
        const appConfig = APP_REGISTRY[appId.toLowerCase()];
        
        if (!appConfig) {
            console.error('Unknown app ID:', appId);
            Xrm.Navigation.openAlertDialog({
                text: "App configuration not found for: " + appId,
                title: "Launch Error"
            });
            return;
        }

        const resourceName = BASE_PATH + '/' + 
            (USE_DEBUGGER ? appConfig.resourceName.replace('.html', '_debugger.html') : appConfig.resourceName);

        const pageInput = {
            pageType: "webresource",
            webresourceName: resourceName
        };

        const navigationOptions = {
            target: 2,
            width: appConfig.width,
            height: appConfig.height,
            position: 1,
            title: appConfig.title
        };

        const contextData = {
            appIdentifier: appConfig.id,
            type: "Unknown",
            entityName: "",
            recordIds: [],
            fetchXml: null,
            userSettings: {
                userName: Xrm.Utility.getGlobalContext().userSettings.userName,
                userId: Xrm.Utility.getGlobalContext().userSettings.userId.replace(/[{}]/g, "")
            }
        };

        if (SelectedControl && SelectedControl.getEntityName) {
            contextData.entityName = SelectedControl.getEntityName();
        } else if (PrimaryControl && PrimaryControl.getEntityName) {
            contextData.entityName = PrimaryControl.getEntityName();
        }

        if (SelectedControlSelectedItemIds && SelectedControlSelectedItemIds.length > 0) {
            contextData.type = SelectedControlSelectedItemIds.length === 1 ? "Form" : "Grid";
            const totalRecords = SelectedControlSelectedItemIds.length;
            
            if (totalRecords <= SUMMARY_THRESHOLD) {
                contextData.recordIds = SelectedControlSelectedItemIds;
            } else {
                contextData.useSummaryMode = true;
                contextData.totalRecordCount = totalRecords;
                contextData.recordIds = [];
                
                const storageKey = "app_selection_" + Date.now() + "_" + Math.random().toString(36).substring(7);
                
                try {
                    sessionStorage.setItem(storageKey, JSON.stringify({ ids: SelectedControlSelectedItemIds }));
                    contextData.selectionKey = storageKey;
                    
                    const listener = function(ev) {
                        try {
                            const msg = ev && ev.data;
                            if (!msg || msg.type !== 'app_request_selection' || msg.key !== storageKey) return;
                            ev.source.postMessage({ 
                                type: 'app_response_selection', 
                                key: storageKey, 
                                ids: SelectedControlSelectedItemIds 
                            }, ev.origin || '*');
                            window.removeEventListener('message', listener);
                        } catch (e) {}
                    };
                    window.addEventListener('message', listener);
                } catch (e) {
                    contextData.recordIds = SelectedControlSelectedItemIds.slice(0, SUMMARY_THRESHOLD);
                }
            }
        } else if (SelectedControl && typeof SelectedControl.getViewSelector === 'function') {
            contextData.type = "Grid";
            try {
                const view = SelectedControl.getViewSelector().getCurrentView();
                contextData.viewId = view.id.replace(/[{}]/g, "");
            } catch (e) {}
        } else if (PrimaryControl && PrimaryControl.data && PrimaryControl.data.entity) {
            contextData.type = "Form";
            try {
                contextData.entityName = PrimaryControl.data.entity.getEntityName();
                const recordId = PrimaryControl.data.entity.getId().replace(/[{}]/g, "");
                contextData.recordIds = [recordId];
            } catch (e) {}
        }

        pageInput.data = encodeURIComponent(JSON.stringify(contextData));
        
        Xrm.Navigation.navigateTo(pageInput, navigationOptions).then(
            function() {},
            function(error) {
                console.error('Navigation error:', error);
                Xrm.Navigation.openAlertDialog({
                    text: "Failed to open " + appConfig.title + ": " + error.message,
                    title: "Launch Error"
                });
            }
        );
    }

    return {
        launch: launch,
        launchFromForm: function(appId, formContext) {
            launch(appId, formContext, null, null);
        },
        launchFromGrid: function(appId, gridContext, selectedIds) {
            launch(appId, null, gridContext, selectedIds);
        },
        getAvailableApps: function() {
            return Object.keys(APP_REGISTRY);
        }
    };
})();


