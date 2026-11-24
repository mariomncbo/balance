import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { configError } from "./lib/env";
import { router } from "./routes";
import { AuthProvider } from "./state/AuthContext";
import { DataProvider } from "./state/DataContext";
import { LockProvider } from "./state/LockContext";
import { SheetProvider } from "./state/SheetContext";
import { ThemeProvider } from "./state/ThemeContext";
import "./styles/tokens.css";
import "./styles/components.css";
import "./styles/app.css";

const root = createRoot(document.getElementById("root")!);

if (configError) {
  root.render(
    <div className="screen-center" role="alert">
      <div>
        <h1 className="b-h1">Falta configurar Balance</h1>
        <p className="b-lead" style={{ marginTop: 8 }}>
          {configError}
        </p>
      </div>
    </div>,
  );
} else {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <LockProvider>
            <DataProvider>
              <SheetProvider>
                <RouterProvider router={router} />
              </SheetProvider>
            </DataProvider>
          </LockProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
