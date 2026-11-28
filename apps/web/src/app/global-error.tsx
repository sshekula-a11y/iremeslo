"use client";

/** Chyba v samotném rozložení stránky – vlastní HTML bez dalších komponent. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="cs">
      <body style={{ fontFamily: "Arial, Helvetica, sans-serif", color: "#05264c", background: "#f4f6f9", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px", textAlign: "center" }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Něco se pokazilo</h1>
          <p style={{ color: "#556273", fontSize: 16 }}>Chybu jsme zaznamenali. Zkuste prosím stránku načíst znovu.</p>
          <button type="button" onClick={() => reset()} style={{ marginTop: 16, background: "#fe820d", color: "#05264c", border: 0, borderRadius: 12, padding: "12px 20px", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
            Zkusit znovu
          </button>
        </main>
      </body>
    </html>
  );
}
