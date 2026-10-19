export function friendlyAuthError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "The email or password doesn't match our records.";
    case "auth/email-already-in-use": return "An account already exists for this email. Try signing in instead.";
    case "auth/weak-password": return "Choose a stronger password with at least 6 characters.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/popup-closed-by-user": return "The sign-in window was closed before finishing.";
    case "auth/popup-blocked": return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/network-request-failed": return "We couldn't connect. Check your internet connection and try again.";
    case "auth/too-many-requests": return "There have been too many attempts. Wait a little before trying again.";
    case "auth/operation-not-allowed": return "This sign-in method isn't enabled yet. Contact your administrator.";
    default: return "We couldn't complete sign-in. Check your details and try again.";
  }
}
