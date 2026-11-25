"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignatureDialog } from "@/components/SignatureDialog";
import { signByToken } from "./actions";

export function RemoteSign({ token, label, defaultName }: { token: string; label: string; defaultName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setOpen(true)}>Podepsat prstem</button>
      {open && (
        <SignatureDialog
          title={`Podpis – ${label.toLowerCase()}`}
          defaultName={defaultName}
          defaultPlace=""
          onSubmit={(name, place, png) => signByToken(token, name, place, png)}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
