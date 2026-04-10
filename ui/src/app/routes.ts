export const appRoutes = {
  home: "/",
  controlRoom: "/control-room",
} as const;

const controlRoomAliases = new Set<string>(["/coffee-shop"]);

export function isControlRoomPath(pathname: string): boolean {
  return pathname === appRoutes.controlRoom || controlRoomAliases.has(pathname);
}
