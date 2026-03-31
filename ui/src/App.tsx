import { CoffeeShopPage } from "#components/app/CoffeeShopPage";
import { NotFoundPage } from "#components/app/NotFoundPage";
import { BrowserMcpLandingPage } from "#components/landing/BrowserMcpLandingPage";
import { appRoutes, isControlRoomPath } from "#lib/routes";

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
