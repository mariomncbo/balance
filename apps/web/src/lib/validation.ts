export const USERNAME = /^[a-z0-9._]{3,30}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

export function validateSignup(f: {
  name: string;
  username: string;
  email: string;
  password: string;
  password2: string;
}) {
  const e: Partial<Record<keyof typeof f, string>> = {};
  if (!f.name.trim()) e.name = "Escribe tu nombre";
  else if (f.name.trim().length > 80) e.name = "Demasiado largo";
  if (!USERNAME.test(f.username))
    e.username = "De 3 a 30 caracteres: letras minúsculas, números, punto o guion bajo";
  if (!EMAIL.test(f.email.trim())) e.email = "Escribe un correo válido";
  if (f.password.length < MIN_PASSWORD) e.password = `Mínimo ${MIN_PASSWORD} caracteres`;
  if (f.password2 !== f.password) e.password2 = "Las contraseñas no coinciden. Vuelve a escribirla.";
  return e;
}
