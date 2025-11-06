export interface ILauncherContext {
    type: "Grid" | "Form" | "Unknown" | "Error" | "Global";
    entityName: string;
    recordIds: string[];
    appIdentifier?: string;
    controlInfo?: any;
    viewId?: string;
    fetchXml?: string;
    totalRecordCount?: number;
    selectedRecordCount?: number;

    // For handling large selections
    useSummaryMode?: boolean;
    selectionKey?: string;

    // User settings
    userSettings?: {
        userId: string;
        userName: string;
        languageId?: number;
    };

    [key: string]: any; // Allow other properties
}