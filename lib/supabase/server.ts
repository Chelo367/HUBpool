// HUBpool V3 does not use a privileged Supabase service client.
// Do not add a service_role key to the public pilot. V4 will add a narrowly
// scoped server-only implementation when authenticated route caching is wired.
export function createServiceClient(): never {
  throw new Error("Privileged Supabase access is intentionally disabled in HUBpool V3.");
}
