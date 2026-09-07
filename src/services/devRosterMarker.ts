/**
 * The demo-profile id marker, kept in its own module.
 *
 * LoginPage must be able to recognise a demo row in every build (so a stale
 * one can never reach verify-pin), but it must NOT drag the demo names into a
 * production bundle. Importing the marker from here — and the roster itself
 * only through a dev-gated dynamic import — keeps those two needs apart.
 */
export const DEV_PROFILE_ID_PREFIX = "dev-demo-";

export function isDevProfile(profileId: string): boolean {
  return profileId.startsWith(DEV_PROFILE_ID_PREFIX);
}
