import { createContext, useContext, ReactNode } from 'react';

export type TabType = 'overview' | 'vocabulary' | 'analytics' | 'manifest';

interface NavigationContextType {
  navigateToTab: (tab: TabType) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({
  children,
  navigateToTab,
}: {
  children: ReactNode;
  navigateToTab: (tab: TabType) => void;
}) {
  return (
    <NavigationContext.Provider value={{ navigateToTab }}>
      {children}
    </NavigationContext.Provider>
  );
}

/** Безопасный хук: возвращает navigateToTab или no-op, если провайдера нет */
export function useNavigationOptional(): NavigationContextType {
  const ctx = useContext(NavigationContext);
  if (ctx === undefined) {
    return { navigateToTab: () => {} };
  }
  return ctx;
}
