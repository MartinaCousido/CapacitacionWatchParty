/**
 * Acceso al almacenamiento del navegador para el nombre del usuario.
 *
 * Todo va envuelto en try/catch por un motivo concreto: en modo incógnito, o
 * con el navegador configurado para bloquear datos de sitios, el solo hecho de
 * ACCEDER a `localStorage` lanza una excepción. Sin el catch, la app no
 * arrancaría. Si falla, se degrada al comportamiento de siempre: campo vacío.
 */

const USER_KEY = "watchparty:user";

export function readStoredUser(): string {
  try {
    return localStorage.getItem(USER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredUser(name: string): void {
  try {
    localStorage.setItem(USER_KEY, name);
  } catch {
    // Sin almacenamiento el nombre simplemente no sobrevive a la recarga.
  }
}
