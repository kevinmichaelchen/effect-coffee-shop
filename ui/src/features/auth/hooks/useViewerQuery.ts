import { useQuery } from "@tanstack/react-query";
import { fetchViewer } from "#features/auth/api/viewer.ts";

export const viewerQueryKey = ["viewer"] as const;

export function useViewerQuery() {
  return useQuery({
    queryKey: viewerQueryKey,
    queryFn: fetchViewer,
    staleTime: 30_000,
  });
}
