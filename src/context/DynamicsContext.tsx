import React, { createContext, useContext } from 'react';
import { ILauncherContext } from '../models/types';

export interface DynamicsContextType {
    userName: string;
    userGuid: string;
    launcherContext: ILauncherContext | null;
}

export const DynamicsContext = createContext<DynamicsContextType | undefined>(undefined);

export const useDynamicsContext = () => {
    const ctx = useContext(DynamicsContext);
    if (!ctx) throw new Error("useDynamicsContext must be used within DynamicsContext.Provider");
    return ctx;
};