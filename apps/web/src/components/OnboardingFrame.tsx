import type { ReactNode } from "react";
import { BackButton } from "./Header";

interface Props {
  step: 1 | 2 | 3 | 4 | 5;
  back: string;
  title: string;
  lead?: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Marco común de los cinco pasos del onboarding: atrás, progreso, título, contenido y acciones. */
export function OnboardingFrame({ step, back, title, lead, children, footer }: Props) {
  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div className="ob-top">
        <BackButton to={back} />
        <div
          className="steps"
          role="progressbar"
          aria-label={`Paso ${step} de 5`}
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={5}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={i <= step ? "on" : undefined} />
          ))}
        </div>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="b-h1">{title}</h1>
        {lead && <p className="b-lead">{lead}</p>}
      </div>
      {children}
      <div className="b-spacer" />
      <div className="b-actions">{footer}</div>
    </main>
  );
}
