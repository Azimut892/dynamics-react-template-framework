const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- TEMPLATE ---
// This is the original template from 'create-app.js'.
// We use this to revert a multi-page app back to a single-page app
// if the user deletes the last remaining page.

const getSinglePageTemplate = (appName) => `
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
  const pageName = process.argv[3];

  if (!appName || !pageName) {
    console.error('Error: You must provide both app name and page name.');
    console.log('Usage: npm run delete-page <AppName> <PageName>');
    process.exit(1);
  }

  const entryPath = path.resolve(process.cwd(), `src/${appName}.tsx`);
  const pagePath = path.resolve(
    process.cwd(),
    `src/components/pages/${appName}/${pageName}Page.tsx`,
  );

  if (!fs.existsSync(entryPath)) {
    console.error(`Error: App entry file not found: ${entryPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(pagePath)) {
    console.error(`Error: Page file not found: ${pagePath}`);
    process.exit(1);
  }
  
  if (appName === pageName) {
      console.error(`Error: Cannot delete the main ${pageName}Page.`);
      console.error('If you want to delete the entire app, run "npm run delete-app ${appName}"');
      process.exit(1);
  }

  console.log(`This will delete the following:`);
  console.log(` - File: ${pagePath}`);
  console.log(` - References to ${pageName} in: ${entryPath}`);

  const confirmed = await askForConfirmation('\nAre you sure you want to proceed? This is irreversible.');

  if (!confirmed) {
    console.log('Deletion cancelled.');
    process.exit(0);
  }

  try {
    console.log('\nDeleting page...');

    fs.rmSync(pagePath, { force: true });
    console.log(`✓ Deleted ${pagePath}`);

    let entryContent = fs.readFileSync(entryPath, 'utf8');
    const pageKey = pageName.toLowerCase();
    let changeCount = 0;
    
    let shouldRevert = false;
    const navLinksMatch = entryContent.match(/links:\s*\[([\s\S]*?)\]/);
    
    if (navLinksMatch && navLinksMatch[1]) {
        if (new RegExp(`key: '${pageKey}'`).test(navLinksMatch[1])) {
            const linkCount = (navLinksMatch[1].match(/{/g) || []).length;
            
            if (linkCount <= 2) {
                shouldRevert = true;
            }
        }
    }

    if (shouldRevert) {
        console.log('✓ Last extra page detected. Reverting to single-page layout...');
        const revertedContent = getSinglePageTemplate(appName);
        fs.writeFileSync(entryPath, revertedContent, 'utf8');
        console.log(`✓ Reverted ${entryPath} to single-page mode.`);
        
    } else {
        console.log('✓ Multiple pages found. Removing one page...');

        const importRegex = new RegExp(`import ${pageName}Page from '.*${pageName}Page';\\r?\\n`, 'g');
        const newContent = entryContent.replace(importRegex, '');
        if (newContent.length < entryContent.length) {
          changeCount++;
          entryContent = newContent;
          console.log(`✓ Removed import from ${appName}.tsx`);
        }

        const navLinkRegex = new RegExp(`\\s*,?\\s*{ name: '${pageName}', key: '${pageKey}'.*\\r?\\n`, 'g');
        const newContent2 = entryContent.replace(navLinkRegex, '');
        if (newContent2.length < entryContent.length) {
          changeCount++;
          entryContent = newContent2;
          console.log(`✓ Removed nav link from ${appName}.tsx`);
        }

        const caseRegex = new RegExp(`\\s*case '${pageKey}':\\s*return <${pageName}Page />;\\s*\\r?\\n`, 'g');
        const newContent3 = entryContent.replace(caseRegex, '');
        if (newContent3.length < entryContent.length) {
          changeCount++;
          entryContent = newContent3;
          console.log(`✓ Removed switch case from ${appName}.tsx`);
        }

        if (changeCount > 0) {
          fs.writeFileSync(entryPath, entryContent, 'utf8');
          console.log(`✓ Successfully updated ${entryPath}`);
        } else {
          console.warn(`! Could not find code references to ${pageName} in ${entryPath}. The page file was deleted, but you may need to clean up the entry file manually.`);
        }
    }

    console.log(`\n✅ Success! Page "${pageName}" has been deleted from "${appName}".`);

  } catch (err) {
    console.error(`Failed to delete page:`, err);
    process.exit(1);
  }
})();