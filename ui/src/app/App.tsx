import { CoffeeShopPage } from "#features/coffee-shop/components/CoffeeShopPage.tsx";
import { NotFoundPage } from "#app/NotFoundPage.tsx";
import { BrowserMcpLandingPage } from "#features/assistant/components/BrowserMcpLandingPage.tsx";
import { appRoutes, isControlRoomPath } from "#app/routes.ts";

export default function App() {
  const pathname = window.location.pathname;
  if (pathname === appRoutes.home) {
    return <BrowserMcpLandingPage />;
  }

  if (isControlRoomPath(pathname)) {
    return <CoffeeShopPage />;
  }

  return <NotFoundPage />;
}
