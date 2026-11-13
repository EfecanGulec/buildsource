import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Upload files to the private order-photos bucket under <orderId>/; returns storage paths. */
export async function uploadOrderPhotos(orderId: string, files: File[]) {
  const paths: string[] = [];
  for (const f of files.slice(0, 5)) {
    const path = `${orderId}/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("order-photos").upload(path, f);
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export function PhotoStrip({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    if (!paths.length) return;
    supabase.storage.from("order-photos").createSignedUrls(paths, 3600).then(({ data }) => setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[]));
  }, [paths.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!urls.length) return null;
  return <div className="mt-2 flex flex-wrap gap-2">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-16 w-16 rounded-md border object-cover" /></a>)}</div>;
}
