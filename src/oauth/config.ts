// OAuth client configuration for the Quire CLI.
//
// Public client — no client_secret. Authorization is gated by PKCE (RFC 7636)
// and a loopback redirect URI per RFC 8252. The OAuth app is registered at
// <https://quire.io/apps/dev/quire_cli>; this constant is the public
// `client_id` from that page.
//
// !!! Development client_id !!!
// This is the *development* OAuth app. Swap for the production `client_id`
// before cutting the first public release.
export const QUIRE_CLI_CLIENT_ID = ":0000mVxxApzA5wCng9iFk3Nzw0v";

// Fixed loopback port for the OAuth callback. The Quire OAuth app form
// requires an exact-match redirect URI (no RFC 8252 §7.3 port-wildcard
// support yet), so the CLI binds to a single known port and the OAuth app's
// registered redirect URI must exactly equal `http://127.0.0.1:<this>/callback`.
//
// Override via $QUIRE_CLI_LOOPBACK_PORT for testing against an OAuth app
// that registers a different port. Range-clamped to a non-privileged port
// (>1023) so the CLI never tries to bind 80/443 without root.
const ENV_PORT = Number.parseInt(process.env.QUIRE_CLI_LOOPBACK_PORT ?? "", 10);
export const QUIRE_CLI_LOOPBACK_PORT =
  Number.isInteger(ENV_PORT) && ENV_PORT > 1023 && ENV_PORT < 65536 ? ENV_PORT : 8866;
