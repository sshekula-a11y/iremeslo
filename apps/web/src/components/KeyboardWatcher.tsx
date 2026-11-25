"use client";

import { useEffect } from "react";

const TYPING = [
  "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range]):not([type=color])",
  "textarea",
  "select",
  "[contenteditable=true]",
].join(",");

/**
 * Na telefonu při psaní vyjede klávesnice a přilepené lišty dole (menu, souhrn) by zabraly skoro
 * celou zbylou obrazovku. Dokud je aktivní políčko, nastavíme na <html> data-kb="1";
 * prvky s třídou kb:hidden se pak schovají (varianta „kb“ v globals.css). Na počítači nic nedělá.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    const update = () => {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.matches(TYPING)) root.dataset.kb = "1";
      else delete root.dataset.kb;
    };
    // Při přeskoku z políčka na políčko přijde focusout dřív než focusin – počkáme, ať lišty neblikají.
    // Lišta se vrací se zpožděním, aby se klepnutí na tlačítko u dolního okraje nezachytilo o vracející se menu.
    const onOut = () => window.setTimeout(update, 400);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", onOut);
      delete root.dataset.kb;
    };
  }, []);
  return null;
}
