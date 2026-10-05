import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

/** Shows a staff photo stored in the private "staff-photos" bucket (or an external link). */
export function StaffPhoto({
  path,
  name,
  size = 48,
}: {
  path: string | null | undefined;
  name: string;
  size?: number;
}) {
  const url = useQuery({
    enabled: !!path,
    queryKey: ["staff-photo", path],
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      if (/^https?:\/\//.test(path)) return path;
      const { data } = await supabase.storage.from("staff-photos").createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-primary"
      style={{ width: size, height: size }}
    >
      {url.data ? (
        <img src={url.data} alt={name} className="h-full w-full object-cover" />
      ) : (
        <UserRound style={{ width: size * 0.55, height: size * 0.55 }} aria-hidden />
      )}
    </span>
  );
}
