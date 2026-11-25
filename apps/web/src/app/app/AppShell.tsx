"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/prihlaseni/actions";
import { NAV_GROUPS, NAV_HOME, NEW_ITEMS, WORKER_ITEMS, activeHref, type NavItem } from "./nav-config";

const COLLAPSED_KEY = "iremeslo-nav-collapsed";

/**
 * Kostra aplikace:
 * - počítač (od 1024 px): boční panel se skupinami menu, hledáním a tlačítkem „+ Nový“,
 * - tablet a telefon: horní lišta s menu (výsuvný panel se stejnými skupinami) a „+ Nový“,
 * - telefon navíc dolní lišta: Přehled, Zakázky, +, Faktury, Menu.
 */
export function AppShell({ worker, companyName, banners, children }: {
  worker: boolean; companyName: string; banners: React.ReactNode; children: React.ReactNode;
}) {
  const path = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);

  // Po přechodu na jinou stránku menu zavřeme.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setDrawer(false); setSheet(false); }

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Boční panel – počítač */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white lg:flex" aria-label="Menu aplikace">
        <SideContent worker={worker} companyName={companyName} path={path} />
      </aside>

      {/* Horní lišta – tablet a telefon */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-white px-3 py-2 lg:hidden">
        <button type="button" className="flex size-11 items-center justify-center rounded-xl text-ink hover:bg-paper" aria-label="Otevřít menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Icon name="menu" className="size-6" />
        </button>
        <Link href={worker ? "/app/moje-zakazky" : "/app"} aria-label="Přehled" className="mr-auto">
          <Logo height={26} priority />
        </Link>
        {!worker && <>
          <Link href="/app/hledat" className="flex size-11 items-center justify-center rounded-xl text-ink hover:bg-paper" aria-label="Hledat"><Icon name="search" /></Link>
          <button type="button" className="hidden h-10 items-center gap-1.5 rounded-xl bg-accent px-3 font-semibold text-ink sm:flex" aria-haspopup="dialog" onClick={() => setSheet(true)}>
            <Icon name="plus" /> Nový
          </button>
        </>}
      </header>

      {banners}
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:pb-8 lg:px-8">{children}</main>

      {/* Dolní lišta – telefon */}
      {!worker && (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden kb:hidden" aria-label="Rychlé menu">
          <BottomLink href="/app" label="Přehled" icon="home" active={path === "/app"} />
          <BottomLink href="/app/zakazky" label="Zakázky" icon="briefcase" active={path.startsWith("/app/zakazky")} />
          <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" className="flex flex-col items-center justify-center" aria-label="Vytvořit nový">
            <span className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-ink shadow-[0_6px_18px_rgba(254,130,13,0.45)] ring-4 ring-white"><Icon name="plus" className="size-7" /></span>
          </button>
          <BottomLink href="/app/faktury" label="Faktury" icon="file" active={path.startsWith("/app/faktury") || path.startsWith("/app/doklady")} />
          <button type="button" onClick={() => setDrawer(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted" aria-label="Celé menu">
            <Icon name="menu" /> Menu
          </button>
        </nav>
      )}

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu aplikace">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Zavřít menu" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-2xl">
            <button type="button" className="absolute right-2 top-2 z-10 flex size-10 items-center justify-center rounded-xl hover:bg-paper" aria-label="Zavřít menu" onClick={() => setDrawer(false)}>
              <Icon name="close" />
            </button>
            <SideContent worker={worker} companyName={companyName} path={path} onNew={() => { setDrawer(false); setSheet(true); }} />
          </div>
        </div>
      )}
      {sheet && <NewSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

function BottomLink({ href, label, icon, active }: { href: string; label: string; icon: "home" | "briefcase" | "file"; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-accent-ink" : "text-muted"}`}>
      <Icon name={icon} /> {label}
    </Link>
  );
}

/** Obsah bočního panelu (stejný na počítači i ve výsuvném menu). */
function SideContent({ worker, companyName, path, onNew }: { worker: boolean; companyName: string; path: string; onNew?: () => void }) {
  const current = activeHref(path);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [popover, setPopover] = useState(false);
  useEffect(() => {
    // Uložený stav menu je jen v prohlížeči – načteme ho po vykreslení, aby nevznikl rozdíl proti serveru.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const v = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]"); if (Array.isArray(v)) setCollapsed(v); } catch { /* bez paměti */ }
  }, []);
  const toggle = (id: string) => setCollapsed((c) => {
    const next = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* bez paměti */ }
    return next;
  });

  const link = (it: NavItem, nested: boolean) => {
    const on = current === it.href;
    return (
      <li key={it.href}>
        <Link href={it.href} aria-current={on ? "page" : undefined}
          className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-[14px] ${nested ? "pl-10" : "font-semibold"} ${on ? "bg-accent-soft font-semibold text-ink" : "text-ink/80 hover:bg-paper hover:text-ink"}`}>
          {!nested && it.icon && <Icon name={it.icon} className="size-5 shrink-0 text-muted" />}
          <span className="min-w-0 flex-1 truncate">{it.label}</span>
          {it.hint && <span className="shrink-0 rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-ink ring-1 ring-line">{it.hint}</span>}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-2 pt-4">
        <Link href={worker ? "/app/moje-zakazky" : "/app"} aria-label="Přehled"><Logo height={28} /></Link>
      </div>

      {!worker && (
        <div className="space-y-2 px-3 pb-2">
          <div className="relative">
            <button type="button" className="btn-primary flex w-full items-center justify-center gap-1.5" aria-haspopup="menu" aria-expanded={popover}
              onClick={() => (onNew ? onNew() : setPopover((o) => !o))}>
              <Icon name="plus" /> Nový
            </button>
            {popover && <NewPopover onClose={() => setPopover(false)} />}
          </div>
          <form action="/app/hledat" role="search">
            <label className="sr-only" htmlFor="side-search">Hledat</label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input id="side-search" name="q" type="search" placeholder="Hledat zákazníka, doklad…" className="field h-10 pl-9 text-[14px]" autoComplete="off" />
            </div>
          </form>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Hlavní menu">
        <ul className="space-y-0.5">
          {worker ? WORKER_ITEMS.map((i) => link(i, false)) : <>
            {link(NAV_HOME, false)}
            {NAV_GROUPS.map((g) => {
              const hasActive = g.items.some((i) => i.href === current);
              const open = hasActive || !collapsed.includes(g.id);
              return (
                <li key={g.id} className="pt-1">
                  <button type="button" onClick={() => toggle(g.id)} aria-expanded={open}
                    className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[14px] font-semibold text-ink hover:bg-paper">
                    <Icon name={g.icon} className="size-5 shrink-0 text-muted" />
                    <span className="flex-1">{g.label}</span>
                    <Icon name="chevron" className={`size-4 text-muted transition-transform ${open ? "" : "-rotate-90"}`} />
                  </button>
                  {open && <ul className="space-y-0.5">{g.items.map((i) => link(i, true))}</ul>}
                </li>
              );
            })}
          </>}
        </ul>
      </nav>

      <div className="border-t border-line px-3 py-3">
        <p className="truncate px-3 text-[13px] font-semibold" title={companyName}>{companyName}</p>
        <form action={signOut}>
          <button className="mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-[14px] text-muted hover:bg-paper hover:text-ink">
            <Icon name="logout" className="size-5" /> Odhlásit
          </button>
        </form>
      </div>
    </div>
  );
}

function NewList({ onPick }: { onPick: () => void }) {
  return (
    <ul className="space-y-0.5">
      {NEW_ITEMS.map((i) => (
        <li key={i.href}>
          <Link href={i.href} onClick={onPick} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 hover:bg-paper" role="menuitem">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink"><Icon name={i.icon} /></span>
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{i.label}</span>
              {i.hint && <span className="block text-[13px] text-muted">{i.hint}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** „+ Nový“ na počítači: rozbalovací nabídka pod tlačítkem. */
function NewPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.parentElement?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className="absolute left-0 top-full z-40 mt-1 w-80 rounded-2xl border border-line bg-white p-2 shadow-[0_16px_40px_rgba(5,38,76,0.18)]">
      <NewList onPick={onClose} />
    </div>
  );
}

/** „+ Nový“ na telefonu a tabletu: panel zespodu. */
function NewSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="novy-title">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Zavřít" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-2xl sm:inset-x-auto sm:right-4 sm:top-16 sm:bottom-auto sm:w-96 sm:rounded-2xl">
        <div className="mb-1 flex items-center justify-between px-3 pt-1">
          <h2 id="novy-title" className="font-display text-[18px] font-extrabold">Vytvořit nový</h2>
          <button type="button" className="flex size-10 items-center justify-center rounded-xl hover:bg-paper" aria-label="Zavřít" onClick={onClose}><Icon name="close" /></button>
        </div>
        <NewList onPick={onClose} />
      </div>
    </div>
  );
}
