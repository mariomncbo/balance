import { EmptyState } from "../components/States";

export default function Goals() {
  return (
    <main className="b-screen b-screen--tabs">
      <div style={{ minHeight: 44, display: "flex", alignItems: "center", paddingRight: 104 }}>
        <h1 className="b-h1" style={{ fontSize: 24, lineHeight: "28px" }}>
          Metas
        </h1>
      </div>
      <EmptyState
        icon="target"
        title="Las metas llegan pronto"
        text="Podrás crear metas como una PS5 o un viaje y verás cuánto apartar cada mes para conseguirlas."
      />
    </main>
  );
}
