// OAuth client configuration for the Quire CLI.
//
// Public client — no client_secret. Authorization is gated by PKCE (RFC 7636)
// and a loopback redirect URI per RFC 8252. The OAuth app is registered at
// <https://quire.io/apps/dev/quire_cli>; this constant is the public
// `client_id` from that page.
//
// !!! Development client_id !!!
// This is the *development* OAuth app. Swap for the production `client_id`
// before cutting the first public release — see PUBLISH.md release checklist.
export const QUIRE_CLI_CLIENT_ID = ":0000mVxxApzA5wCng9iFk3Nzw0v";
