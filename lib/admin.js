// Who may approve payments. Set ADMIN_EMAILS in Vercel, for example: you@example.com,partner@example.com
export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// The person must be signed in with a confirmed email that is on the list.
export function isAdminUser(user) {
  return Boolean(user?.email) && Boolean(user?.email_confirmed_at) && adminEmails().includes(user.email.toLowerCase());
}
