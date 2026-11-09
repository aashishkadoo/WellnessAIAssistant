//src/context/ScreenLayoutContext.tsx
import React, {
  createContext,
  useContext,
  type ReactNode,
} from "react";

export type ScreenLayout = {
  /** Top padding, including the device's status-bar safe area. */
  topPadding: number;

  /** Standard horizontal screen margin. */
  horizontalPadding: number;

  /**
   * Total bottom scroll clearance.
   * Includes the measured navigation wrapper and an additional gap.
   */
  bottomPadding: number;

  /** Measured height of the bottom navigation wrapper. */
  bottomNavigationHeight: number;
};

const DEFAULT_LAYOUT: ScreenLayout = {
  topPadding: 8,
  horizontalPadding: 20,
  bottomPadding: 120,
  bottomNavigationHeight: 72,
};

const ScreenLayoutContext =
  createContext<ScreenLayout>(DEFAULT_LAYOUT);

type ScreenLayoutProviderProps = {
  value: ScreenLayout;
  children: ReactNode;
};

export function ScreenLayoutProvider({
  value,
  children,
}: ScreenLayoutProviderProps) {
  return (
    <ScreenLayoutContext.Provider value={value}>
      {children}
    </ScreenLayoutContext.Provider>
  );
}

export function useScreenLayout(): ScreenLayout {
  return useContext(ScreenLayoutContext);
}
