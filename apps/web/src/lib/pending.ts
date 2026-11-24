// Correo pendiente de verificar: sobrevive a recargar la pestaña, pero no a cerrarla.
const KEY = "balance.pendingEmail";
export const setPendingEmail = (email: string) => {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    /* nada */
  }
};
export const getPendingEmail = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const clearPendingEmail = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nada */
  }
};
