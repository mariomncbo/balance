import { lazy, Suspense } from "react";
import { useSheet } from "../state/SheetContext";
import { AddMenu } from "./AddMenu";

const AccountSheet = lazy(() => import("../sheets/AccountSheet"));
const MovementSheet = lazy(() => import("../sheets/MovementSheet"));
const RecurringSheet = lazy(() => import("../sheets/RecurringSheet"));

/** Dibuja la hoja que esté abierta, por encima de cualquier pantalla. */
export function SheetHost() {
  const { sheet } = useSheet();
  if (!sheet) return null;
  return (
    <Suspense fallback={null}>
      {sheet.kind === "menu" && <AddMenu />}
      {sheet.kind === "account" && <AccountSheet key={sheet.id ?? "new"} id={sheet.id} local={sheet.local} />}
      {sheet.kind === "movement" && <MovementSheet key={sheet.id ?? "new"} id={sheet.id} />}
      {sheet.kind === "recurring" && <RecurringSheet key={sheet.id ?? "new"} id={sheet.id} />}
    </Suspense>
  );
}
