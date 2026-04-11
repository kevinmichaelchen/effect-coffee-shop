import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { appRoutes } from "#app/routes.ts";

export function NotFoundPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-4 py-6">
      <Card className="w-full border-border bg-card">
        <Card.Content className="grid gap-4 p-6 text-center">
          <Text as="h1" className="text-4xl leading-none">
            Route not found
          </Text>
          <Text as="p" className="text-muted-foreground">
            Head back to Beanline or jump into the Coffee Shop control room.
          </Text>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <a href={appRoutes.home}>Open landing page</a>
            </Button>
            <Button asChild variant="outline">
              <a href={appRoutes.controlRoom}>Open control room</a>
            </Button>
          </div>
        </Card.Content>
      </Card>
    </main>
  );
}
