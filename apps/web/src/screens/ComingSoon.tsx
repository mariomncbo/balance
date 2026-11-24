import { useLocation } from "react-router";
import { Header } from "../components/Header";
import { EmptyState } from "../components/States";

const COPY: Record<string, { title: string; text: string; icon: "spark" | "bolt" | "target" }> = {
  "/chat": {
    title: "Asistente",
    text: "Pronto podrás preguntarle por tus gastos y tus metas.",
    icon: "spark",
  },
  "/atajo": {
    title: "Registro automático",
    text: "Pronto podrás configurar el Atajo del iPhone para que tus pagos se apunten solos.",
    icon: "bolt",
  },
};

export default function ComingSoon() {
  const { pathname } = useLocation();
  const c = COPY[pathname] ?? {
    title: "Pronto",
    text: "Esta pantalla llega en una próxima fase.",
    icon: "target" as const,
  };
  return (
    <main className="b-screen">
      <Header title={c.title} to="/" />
      <EmptyState icon={c.icon} title="Disponible pronto" text={c.text} />
    </main>
  );
}
