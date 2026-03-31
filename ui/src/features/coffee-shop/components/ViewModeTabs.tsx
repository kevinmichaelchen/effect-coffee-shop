import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsPanels, TabsTrigger, TabsTriggerList } from "#shared/ui/retroui/Tab.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { viewModes, type ViewMode } from "#features/coffee-shop/components/view-mode.ts";

const viewLabels: Record<ViewMode, string> = {
  dual: "Dual View",
  customer: "Customer Only",
  barista: "Barista Only",
};

interface ViewModeTabsProps {
  baristaPanel: ReactNode;
  customerPanel: ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeTabs(inputProps: ViewModeTabsProps) {
  const { baristaPanel, customerPanel, viewMode, onViewModeChange } = inputProps;
  const selectedIndex = viewModes.indexOf(viewMode);

  return (
    <Tabs selectedIndex={selectedIndex} onChange={(index) => onViewModeChange(viewModes[index] ?? "dual")}>
      <div className="grid gap-2">
        <Text as="p" className="text-sm uppercase tracking-[0.08em] text-muted-foreground">
          Workspace mode
        </Text>
        <TabsTriggerList className="flex flex-wrap gap-2">
          {viewModes.map((mode) => (
            <TabsTrigger key={mode}>{viewLabels[mode]}</TabsTrigger>
          ))}
        </TabsTriggerList>
      </div>
      <TabsPanels>
        <TabsContent className="mt-4 border-none p-0">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            {customerPanel}
            {baristaPanel}
          </div>
        </TabsContent>
        <TabsContent className="mt-4 border-none p-0">{customerPanel}</TabsContent>
        <TabsContent className="mt-4 border-none p-0">{baristaPanel}</TabsContent>
      </TabsPanels>
    </Tabs>
  );
}
