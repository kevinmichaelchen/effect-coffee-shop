import { NotFoundPage } from "#app/NotFoundPage.tsx";
import { CoffeeCustomerPage } from "#features/coffee-shop/components/CoffeeCustomerPage.tsx";
import { CoffeeStaffPage } from "#features/coffee-shop/components/CoffeeStaffPage.tsx";
import { appRoutes, isShopPath } from "#app/routes.ts";

export default function App() {
  const pathname = window.location.pathname;
  if (pathname === appRoutes.home || isShopPath(pathname)) {
    return <CoffeeCustomerPage />;
  }

  if (pathname === appRoutes.staff) {
    return <CoffeeStaffPage />;
  }

  return <NotFoundPage />;
}
