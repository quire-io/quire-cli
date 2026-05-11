// OAuth client configuration for the Quire CLI.
//
// Public client — no client_secret. Authorization is gated by PKCE (RFC 7636)
// and a loopback redirect URI per RFC 8252. The OAuth app is registered at
// <https://quire.io/apps/dev/quire_cli>; this constant is the published
// `client_id` from that page.
export const QUIRE_CLI_CLIENT_ID = "0mVxxApzA5wCng9iFk3Nzw0v";
