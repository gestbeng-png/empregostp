import { createContext, useContext } from "react";

const DashboardShellContext = createContext(false);

export const DashboardShellProvider = DashboardShellContext.Provider;

export function useIsInsideDashboardShell() {
  return useContext(DashboardShellContext);
}
