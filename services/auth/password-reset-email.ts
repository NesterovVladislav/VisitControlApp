// Передаём email между публичными экранами один раз, без параметров URL.
let pendingEmail = '';

export function prefillPasswordResetEmail(email: string) {
  pendingEmail = email.trim();
}

export function takePasswordResetEmail(): string {
  const email = pendingEmail;
  pendingEmail = '';
  return email;
}
