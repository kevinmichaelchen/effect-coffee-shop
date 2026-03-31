import { Button } from "#components/retroui/Button";
import { Drawer } from "#components/retroui/Drawer";
import { ToolActivityFeed } from "#components/landing/ToolActivityCard";
import type { AssistantEvent } from "#lib/assistant-loop";

interface ToolActivityDrawerProps {
  events: readonly AssistantEvent[];
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
            Exact MCP requests and results from this tab. Unsupported fields are stripped before
            the browser sends a tool call.
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
