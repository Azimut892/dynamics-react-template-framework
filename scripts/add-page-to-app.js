const fs = require('fs');
const path = require('path');

// --- TEMPLATES ---

const pageTemplate = (appName, pageName) => `
import React from 'react';
import { Stack, Text } from '@fluentui/react';
import { useDynamicsContext } from '../../../context/DynamicsContext';

const ${pageName}Page: React.FC = () => {
    const { launcherContext } = useDynamicsContext();

    return (
        <Stack tokens={{ childrenGap: 15 }} style={{ padding: 20 }}>
            <Text variant="xxLarge">${pageName}</Text>
            {launcherContext && (
                <Text>
                    App loaded for entity: {launcherContext.entityName}
                </Text>
            )}
        </Stack>
    );
};

export default ${pageName}Page;
`;

// --- SCRIPT LOGIC ---
(function main() {
    const appName = process.argv[2];
    const pageName = process.argv[3];

    if (!appName || !pageName) {
        console.error('Error: You must provide both app name and page name.');
        console.log('Usage: npm run add-page <AppName> <PageName>');
        console.log('Example: npm run add-page MyNewTool Settings');
        process.exit(1);
    }

    // Validate names
    if (!/^[A-Z][a-zA-Z0-9]+$/.test(appName) || !/^[A-Z][a-zA-Z0-9]+$/.test(pageName)) {
        console.error('Error: Both names must be PascalCase (e.g., "MyNewTool", "Settings").');
        process.exit(1);
    }

    console.log(`Adding ${pageName} page to ${appName} app...\n`);

    try {
        // 1. Define paths
        const entryPath = path.resolve(process.cwd(), `src/${appName}.tsx`);
        const appPageDir = path.resolve(process.cwd(), `src/components/pages/${appName}`);
        const newPagePath = path.resolve(appPageDir, `${pageName}Page.tsx`);

        // 2. Check if app exists
        if (!fs.existsSync(entryPath)) {
            console.error(`Error: App "${appName}" does not exist!`);
            console.error(`File not found: ${entryPath}`);
            process.exit(1);
        }

        if (!fs.existsSync(appPageDir)) {
            console.error(`Error: App page directory does not exist: ${appPageDir}`);
            process.exit(1);
        }

        // 3. Check if page already exists
        if (fs.existsSync(newPagePath)) {
            console.error(`Error: Page "${pageName}" already exists in ${appName}!`);
            process.exit(1);
        }

        // 4. Create the new page component
        console.log(`Creating page component: ${newPagePath}`);
        fs.writeFileSync(newPagePath, pageTemplate(appName, pageName), 'utf8');

        // 5. Update the entry file to add navigation
        console.log(`Updating entry file: ${entryPath}`);
        let entryContent = fs.readFileSync(entryPath, 'utf8');

        // Add import for new page
        const importStatement = `import ${pageName}Page from './components/pages/${appName}/${pageName}Page';`;
        
        // Find where to insert the import (after other page imports)
        const lastPageImportMatch = entryContent.match(/import\s+\w+Page\s+from\s+['"]\.\/components\/pages\/[^'"]+['"];/g);
        if (lastPageImportMatch) {
            const lastImport = lastPageImportMatch[lastPageImportMatch.length - 1];
            const insertIndex = entryContent.indexOf(lastImport) + lastImport.length;
            entryContent = entryContent.slice(0, insertIndex) + '\n' + importStatement + entryContent.slice(insertIndex);
        } else {
            // If no page imports found, add after context imports
            const contextImportMatch = entryContent.match(/import.*from\s+['"]\.\/context\/[^'"]+['"];/);
            if (contextImportMatch) {
                const insertIndex = entryContent.indexOf(contextImportMatch[0]) + contextImportMatch[0].length;
                entryContent = entryContent.slice(0, insertIndex) + '\n' + importStatement + entryContent.slice(insertIndex);
            }
        }

        // Check if there's already a navigation structure
        const hasNavigation = entryContent.includes('const navLinkGroups') || entryContent.includes('<Nav');

        if (!hasNavigation) {
            // Create a new navigation structure
            console.log('No navigation found - creating navigation structure...');
            
            // Find the main page component name
            const mainPageMatch = entryContent.match(/import\s+(\w+Page)\s+from/);
            const mainPageName = mainPageMatch ? mainPageMatch[1].replace('Page', '') : 'Home';

            const navigationCode = `
import { Nav, Stack, initializeIcons } from '@fluentui/react';
import { INavLinkGroup, INavStyles } from '@fluentui/react/lib/Nav';
import { useState } from 'react';

initializeIcons();

const navStyles: Partial<INavStyles> = {
    root: {
        width: 200,
        height: '100vh',
        boxSizing: 'border-box',
        borderRight: '1px solid #e1dfdd',
        backgroundColor: '#f3f2f1'
    }
};

const navLinkGroups: INavLinkGroup[] = [
    {
        links: [
            { name: '${mainPageName}', key: '${mainPageName.toLowerCase()}', url: '#', icon: 'Home' },
            { name: '${pageName}', key: '${pageName.toLowerCase()}', url: '#', icon: 'Page' }
        ]
    }
];

const AppContent: React.FC = () => {
    const [selectedPage, setSelectedPage] = useState<string>('${mainPageName.toLowerCase()}');

    const onNavLinkClick = (ev?: React.MouseEvent<HTMLElement>, item?: any) => {
        ev?.preventDefault();
        if (item && item.key) setSelectedPage(item.key as string);
    };

    const renderCurrentPage = () => {
        switch (selectedPage) {
            case '${mainPageName.toLowerCase()}':
                return <${mainPageMatch ? mainPageMatch[1] : 'HomePage'} />;
            case '${pageName.toLowerCase()}':
                return <${pageName}Page />;
            default:
                return <${mainPageMatch ? mainPageMatch[1] : 'HomePage'} />;
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            <Stack horizontal style={{ width: '100%' }}>
                <Nav 
                    selectedKey={selectedPage} 
                    onLinkClick={onNavLinkClick} 
                    groups={navLinkGroups} 
                    styles={navStyles} 
                />
                <Stack.Item grow className="main-content" style={{ overflowY: 'auto', width: '100%' }}>
                    {renderCurrentPage()}
                </Stack.Item>
            </Stack>
        </div>
    );
};
`;

            // Replace the simple mounting with navigation structure
            const mountFunctionMatch = entryContent.match(/root\.render\(([\s\S]*?)\);/);
            if (mountFunctionMatch) {
                const oldRender = mountFunctionMatch[1];
                const newRender = `
    <React.StrictMode>
      <DynamicsProvider>
        <AppContent />
      </DynamicsProvider>
    </React.StrictMode>`;
                
                entryContent = entryContent.replace(mountFunctionMatch[0], `root.render(${newRender});`);
                
                // Add navigation code before the mountApp function
                const mountAppMatch = entryContent.match(/function mountApp\(\)/);
                if (mountAppMatch) {
                    const insertIndex = entryContent.indexOf(mountAppMatch[0]);
                    entryContent = entryContent.slice(0, insertIndex) + navigationCode + '\n' + entryContent.slice(insertIndex);
                }
            }

        } else {
            // Update existing navigation
            console.log('Updating existing navigation...');
            
            // Add to navLinkGroups array
            const navLinksMatch = entryContent.match(/links:\s*\[([\s\S]*?)\]/);
            if (navLinksMatch) {
                const links = navLinksMatch[1];
                const lastLink = links.trim().split(',').filter(l => l.trim()).pop();
                const newLink = `{ name: '${pageName}', key: '${pageName.toLowerCase()}', url: '#', icon: 'Page' }`;
                
                entryContent = entryContent.replace(
                    navLinksMatch[0],
                    navLinksMatch[0].replace(']', `,\n            ${newLink}\n        ]`)
                );
            }

            // Add to switch statement
            const switchMatch = entryContent.match(/switch\s*\(\s*selectedPage\s*\)\s*\{([\s\S]*?)default:/);
            if (switchMatch) {
                const newCase = `case '${pageName.toLowerCase()}':\n                return <${pageName}Page />;\n            `;
                entryContent = entryContent.replace('default:', newCase + 'default:');
            }
        }

        // Write the updated entry file
        fs.writeFileSync(entryPath, entryContent, 'utf8');

        console.log(`\n✅ Success! Page "${pageName}" has been added to "${appName}"!`);
        console.log(`\nCreated:`);
        console.log(`  - ${newPagePath}`);
        console.log(`\nUpdated:`);
        console.log(`  - ${entryPath}`);
        console.log(`\n🚀 You can now run: npm run build`);

    } catch (err) {
        console.error(`Failed to add page: ${err}`);
        process.exit(1);
    }
})();