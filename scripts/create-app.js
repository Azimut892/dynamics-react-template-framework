const fs = require('fs');
const path = require('path');

// --- TEMPLATES ---
const entryTemplate = (appName) => `
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DynamicsProvider } from './context/DynamicsProvider';
import ${appName}Page from './components/pages/${appName}/${appName}Page';

function mountApp() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('Root element not found - cannot mount ${appName} app');
    return;
  }
  const root = ReactDOM.createRoot(rootEl as HTMLElement);
  root.render(
    <React.StrictMode>
      <DynamicsProvider>
        <${appName}Page />
      </DynamicsProvider>
    </React.StrictMode>
  );
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  mountApp();
} else {
  window.addEventListener('DOMContentLoaded', mountApp);
}
`;

const pageTemplate = (appName) => `
import React from 'react';
import { Stack, Text } from '@fluentui/react';
import { useDynamicsContext } from '../../../context/DynamicsContext';

const ${appName}Page: React.FC = () => {
    const { launcherContext } = useDynamicsContext();

    return (
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: 20 }}>
            <Text variant="xxLarge">Welcome to ${appName}</Text>
            {launcherContext && (
                <Text>
                    App loaded for entity: {launcherContext.entityName}
                </Text>
            )}
        </Stack>
    );
};

export default ${appName}Page;
`;

// --- LAUNCHER GENERATION ---
const WEB_RESOURCE_BASE_PATH = 'prefix_/reactapp';
const USE_DEBUGGER = false;

function generateLauncher(apps) {
  const appConfigs = apps.map(app => `
    '${app.name.toLowerCase()}': {
        id: '${app.name.toLowerCase()}',
        resourceName: '${app.htmlFile}',
        title: '${app.name}',
        width: { value: 80, unit: "%" },
        height: { value: 90, unit: "%" }
    }`).join(',');

  const appButtons = apps.map(app => {
    const functionName = `open${app.name}`;
    return `
/**
 * Opens ${app.name} from a button
 * Can be called from Form or Grid context
 */
function ${functionName}(PrimaryControl, SelectedControl, SelectedControlSelectedItemIds) {
    AppLauncher.launch('${app.name.toLowerCase()}', PrimaryControl, SelectedControl, SelectedControlSelectedItemIds);
}`;
  }).join('\n');

  return `/**
 * =================================================================================
 * REACT APP LAUNCHER - Auto-generated on ${new Date().toISOString()}
 * =================================================================================
 */

var AppLauncher = (function() {
    'use strict';

    const SUMMARY_THRESHOLD = 100;
    const BASE_PATH = '${WEB_RESOURCE_BASE_PATH}';
    const USE_DEBUGGER = ${USE_DEBUGGER};

    const APP_REGISTRY = {${appConfigs}
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

${appButtons}
`;
}

// --- SCRIPT LOGIC ---
(function main() {
  const appName = process.argv[2];

  if (!appName) {
    console.error('Error: You must provide an app name.');
    console.log('Usage: npm run create-app <AppName>');
    process.exit(1);
  }

  if (!/^[A-Z][a-zA-Z0-9]+$/.test(appName)) {
    console.error('Error: AppName must be PascalCase (e.g., "NewApp", "MyTool").');
    process.exit(1);
  }

  console.log(`Scaffolding new app: ${appName}...`);

  try {
    const configPath = path.resolve(process.cwd(), 'scripts/app.config.js');
    
    let configFileContent = fs.readFileSync(configPath, 'utf8');
    
    delete require.cache[require.resolve(configPath)];
    const appConfig = require(configPath);
    
    const entryPath = path.resolve(process.cwd(), `src/${appName}.tsx`);
    const pageDir = path.resolve(process.cwd(), `src/components/pages/${appName}`);
    const pagePath = path.resolve(pageDir, `${appName}Page.tsx`);
    const launcherPath = path.resolve(process.cwd(), 'dynamics/AppLauncher.js');

    if (fs.existsSync(entryPath) || fs.existsSync(pageDir)) {
      console.error(`Error: App "${appName}" already exists!`);
      process.exit(1);
    }
    const appConfigEntry = appConfig.find(app => app.name === appName);
    if (appConfigEntry) {
      console.error(`Error: App "${appName}" already exists in app.config.js!`);
      process.exit(1);
    }

    console.log(`Creating page directory: ${pageDir}`);
    fs.mkdirSync(pageDir, { recursive: true });

    console.log(`Creating page component: ${pagePath}`);
    fs.writeFileSync(pagePath, pageTemplate(appName), 'utf8');

    console.log(`Creating entry point: ${entryPath}`);
    fs.writeFileSync(entryPath, entryTemplate(appName), 'utf8');

    console.log(`\nUpdating app.config.js...`);
    
    const newEntry = {
      name: appName,
      entry: `src/${appName}.tsx`,
      htmlFile: `${appName}.html`
    };

    appConfig.push(newEntry);

    const entriesString = appConfig.map(app => {
        return `    {
    name: '${app.name}',
    entry: '${app.entry}',
    htmlFile: '${app.htmlFile}'
    }`;
    }).join(',\n');

    const updatedContent = `module.exports = [\n${entriesString}\n];\n`;
    fs.writeFileSync(configPath, updatedContent, 'utf8');
    
    console.log(`\nRegenerating AppLauncher.js...`);

    const launcherContent = generateLauncher(appConfig);
    
    const launcherDir = path.dirname(launcherPath);
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
    }
    
    fs.writeFileSync(launcherPath, launcherContent, 'utf8');

    console.log(`\n✅ Success! App "${appName}" has been created!`);
    console.log(`\nCreated files:`);
    console.log(`  - ${entryPath}`);
    console.log(`  - ${pagePath}`);
    console.log(`\nUpdated:`);
    console.log(`  - ${configPath}`);
    console.log(`  - ${launcherPath}`);
    console.log(`\n🚀 Launcher function created: open${appName}()`);
    console.log(`\n💡 Next steps:`);
    console.log(`  1. Run: npm run build`);
    console.log(`  2. Upload ${appName}.html to Dynamics 365`);
    console.log(`  3. Upload dynamics/AppLauncher.js to Dynamics 365`);
    console.log(`  4. Create a command button that calls: open${appName}()`);

  } catch (err) {
    console.error(`Failed to create app:`, err);
    console.error(err.stack);
    process.exit(1);
  }
})();