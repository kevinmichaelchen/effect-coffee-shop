import { Button } from "#shared/ui/retroui/Button.tsx";
import { Drawer } from "#shared/ui/retroui/Drawer.tsx";
import { ToolActivityFeed } from "#features/assistant/components/ToolActivityCard.tsx";
import type { AssistantToolActivity } from "#features/assistant/lib/assistant-chat.ts";

interface ToolActivityDrawerProps {
  events: readonly AssistantToolActivity[];
}

export function ToolActivityDrawer({ events }: ToolActivityDrawerProps) {
  return (
    <Drawer direction="right" shouldScaleBackground={false}>
      <Drawer.Trigger asChild>
        <Button variant="outline">
          Tool activity
          <span className="ml-2 border-l-2 border-border pl-2 text-xs">{events.length}</span>
        </Button>
      </Drawer.Trigger>
      <Drawer.Content className="border-l-2 border-border data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-2xl">
        <Drawer.Header>
          <Drawer.Title>Tool activity</Drawer.Title>
          <Drawer.Description>
            Server-side tool calls emitted while Beanline works through the live coffee route.
          </Drawer.Description>
        </Drawer.Header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
          <ToolActivityFeed events={events} />
        </div>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="outline">Close</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}
