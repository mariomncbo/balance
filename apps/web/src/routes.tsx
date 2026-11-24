import { createBrowserRouter, Navigate, Outlet, type RouteObject } from "react-router";
import { SheetHost } from "./components/SheetHost";
import { PublicOnly, RequireAuth, RequireSession } from "./state/guards";
import { TabLayout } from "./components/TabLayout";

type Screen = () => Promise<{ default: React.ComponentType }>;
const lazy = (load: Screen): Pick<RouteObject, "lazy"> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

function Root() {
  return (
    <div className="app">
      <Outlet />
      <SheetHost />
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    element: <Root />,
    HydrateFallback: () => null,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: "bienvenida", ...lazy(() => import("./screens/Welcome")) },
          { path: "onboarding/saldo", ...lazy(() => import("./screens/onboarding/Balance")) },
          { path: "onboarding/prestamos", ...lazy(() => import("./screens/onboarding/Loans")) },
          { path: "onboarding/sueldo", ...lazy(() => import("./screens/onboarding/Salary")) },
          { path: "onboarding/atajo", ...lazy(() => import("./screens/onboarding/Shortcut")) },
          { path: "onboarding/escaneo", ...lazy(() => import("./screens/onboarding/Scan")) },
          { path: "registro", ...lazy(() => import("./screens/Signup")) },
          { path: "entrar", ...lazy(() => import("./screens/Login")) },
          { path: "recuperar", ...lazy(() => import("./screens/Recover")) },
        ],
      },
      { path: "verificar", ...lazy(() => import("./screens/Verify")) },
      { path: "nueva-contrasena", ...lazy(() => import("./screens/NewPassword")) },
      {
        element: <RequireSession />,
        children: [
          { path: "pin/crear", ...lazy(() => import("./screens/CreatePin")) },
          { path: "desbloqueo", ...lazy(() => import("./screens/Unlock")) },
          { path: "olvido-pin", ...lazy(() => import("./screens/ForgotPin")) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <TabLayout />,
            children: [
              { index: true, ...lazy(() => import("./screens/Home")) },
              { path: "movimientos", ...lazy(() => import("./screens/Movements")) },
              { path: "metas", ...lazy(() => import("./screens/Goals")) },
            ],
          },
          { path: "movimientos/:id", ...lazy(() => import("./screens/MovementDetail")) },
          { path: "cuentas/:id", ...lazy(() => import("./screens/AccountDetail")) },
          { path: "informe", ...lazy(() => import("./screens/Report")) },
          { path: "ajustes", ...lazy(() => import("./screens/Settings")) },
          { path: "chat", ...lazy(() => import("./screens/ComingSoon")) },
          { path: "atajo", ...lazy(() => import("./screens/ComingSoon")) },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
