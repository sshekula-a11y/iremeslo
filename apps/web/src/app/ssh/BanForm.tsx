import { ActionForm } from "./ActionForm";
import { setUserBanned } from "./actions";

/** Zablokování / odblokování uživatele s povinným důvodem. */
export function BanForm({ userId, banned, companyId }: { userId: string; banned: boolean; companyId?: string }) {
  return (
    <ActionForm action={setUserBanned} submit={banned ? "Odblokovat" : "Zablokovat"} tone={banned ? "ghost" : "danger"} className="flex flex-wrap items-end gap-2 space-y-0">
      <input type="hidden" name="user" value={userId} />
      <input type="hidden" name="banned" value={banned ? "false" : "true"} />
      {companyId && <input type="hidden" name="company" value={companyId} />}
      <input name="reason" required minLength={3} className="field w-52 py-2 text-[14px]" placeholder="Důvod" aria-label="Důvod" />
    </ActionForm>
  );
}

