const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- LAUNCHER GENERATION ---
// This function is copied from create-app.js to keep this script standalone
// In a real refactor, this would be in a shared 'lib' file.
const WEB_RESOURCE_BASE_PATH = 'prefix_/reactapp';
const USE_DEBUGGER = false;

function generateLauncher(apps) {
  const appConfigs = apps
    .map((app) => {
      if (!app || !app.name) return ''; // Safety check for bad config
      return `
    '${app.name.toLowerCase()}': {
        id: '${app.name.toLowerCase()}',
        resourceName: '${app.htmlFile}',
        title: '${app.name}',
        width: { value: 80, unit: '%' },
        height: { value: 90, unit: '%' }
    }`;
    })
    .join(',');

  const appButtons = apps
    .map((app) => {
      if (!app || !app.name) return ''; // Safety check
      const functionName = `open${app.name}`;
      return `
/**
 * Opens ${app.name} from a button
 * Can be called from Form or Grid context
 */
function ${functionName}(PrimaryControl, SelectedControl, SelectedControlSelectedItemIds) {
    AppLauncher.launch('${app.name.toLowerCase()}', PrimaryControl, SelectedControl, SelectedControlSelectedItemIds);
}`;
    })
    .join('\n');

  // The rest of the launcher template... (it's long, so I'll just include the C-pasted logic)
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

function askForConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question + ' (y/n) ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

(async function main() {
  const appName = process.argv[2];

  if (!appName) {
    console.error('Error: You must provide an app name to delete.');
    console.log('Usage: npm run delete-app <AppName>');
    process.exit(1);
  }

  console.log(`Preparing to delete app: ${appName}...\n`);

  const configPath = path.resolve(process.cwd(), 'scripts/app.config.js');
  const launcherPath = path.resolve(process.cwd(), 'dynamics/AppLauncher.js');
  const entryPath = path.resolve(process.cwd(), `src/${appName}.tsx`);
  const pageDir = path.resolve(process.cwd(), `src/components/pages/${appName}`);

  delete require.cache[require.resolve(configPath)]; // Clear cache
  let appConfig = require(configPath);
  const appIndex = appConfig.findIndex((app) => app.name === appName);

  if (appIndex === -1) {
    console.error(`Error: App "${appName}" not found in app.config.js.`);
    process.exit(1);
  }

  console.log('This will delete the following:');
  console.log(` - Entry in app.config.js`);
  console.log(` - Entry in dynamics/AppLauncher.js`);
  if (fs.existsSync(entryPath)) console.log(` - File: ${entryPath}`);
  if (fs.existsSync(pageDir)) console.log(` - Directory: ${pageDir}`);
  
  const confirmed = await askForConfirmation('\nAre you sure you want to proceed? This is irreversible.');

  if (!confirmed) {
    console.log('Deletion cancelled.');
    process.exit(0);
  }

  try {
    console.log('\nDeleting app...');

    appConfig.splice(appIndex, 1);
    const entriesString = appConfig
      .map((app) => {
        return `  {
    name: '${app.name}',
    entry: '${app.entry}',
    htmlFile: '${app.htmlFile}'
  }`;
      })
      .join(',\n');
    const updatedConfigContent = `module.exports = [\n${entriesString}\n];\n`;
    fs.writeFileSync(configPath, updatedConfigContent, 'utf8');
    console.log(`✓ Removed ${appName} from app.config.js`);

    const launcherContent = generateLauncher(appConfig);
    fs.writeFileSync(launcherPath, launcherContent, 'utf8');
    console.log(`✓ Regenerated dynamics/AppLauncher.js`);

    if (fs.existsSync(entryPath)) {
      fs.rmSync(entryPath, { force: true });
      console.log(`✓ Deleted ${entryPath}`);
    }

    if (fs.existsSync(pageDir)) {
      fs.rmSync(pageDir, { recursive: true, force: true });
      console.log(`✓ Deleted ${pageDir}`);
    }

    console.log(`\n✅ Success! App "${appName}" has been deleted.`);
  } catch (err) {
    console.error(`Failed to delete app:`, err);
    process.exit(1);
  }
})();