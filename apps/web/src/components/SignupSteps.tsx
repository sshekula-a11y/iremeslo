/** Kroky po registraci – stejné na gratulaci i při zakládání firmy, ať je vidět, kde člověk je. */
const STEPS = [
  { title: "Potvrďte e-mail", text: "Klikněte na odkaz, který jsme vám poslali." },
  { title: "Zadejte IČO", text: "Název, adresu i DIČ vaší firmy načteme z ARES." },
  { title: "Doplňte účet a logo", text: "V nastavení, aby faktury měly QR Platbu a vaše logo." },
  { title: "Vystavte první nabídku", text: "Zakázku spočítáte i na stavbě z telefonu." },
];

export const SIGNUP_STEP_COUNT = STEPS.length;
export const signupStepTitle = (i: number) => STEPS[i]?.title ?? "";

export function SignupSteps({ current, email }: { current: number; email?: string }) {
  return (
    <ol className="space-y-3">
      {STEPS.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s.title} className="flex gap-3" aria-current={now ? "step" : undefined}>
            <span className={`num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
              done ? "bg-ok text-white" : now ? "bg-accent text-ink" : "bg-paper text-muted ring-1 ring-line"}`} aria-hidden="true">
              {done ? "✓" : i + 1}
            </span>
            <div>
              <p className={`font-semibold ${done ? "text-muted line-through decoration-ok/40" : now ? "text-ink" : "text-muted"}`}>
                {s.title}{done && <span className="sr-only"> – hotovo</span>}
              </p>
              <p className="text-[14px] text-muted">
                {now && i === 0 && email ? <>Poslali jsme odkaz na <strong className="text-ink">{email}</strong>. Klikněte na něj.</> : s.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
