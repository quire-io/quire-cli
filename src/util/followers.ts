/**
 * Create-time follower handling for tasks, docs and chats.
 *
 * Since the Oct 29 2026 server release, only the users in `followers` (plus
 * anyone @mentioned in a task's or doc's description) follow a new record —
 * Quire no longer adds the current user. The CLI adds `"me"` itself so that
 * whoever runs `create` keeps following what they made, as in the Quire apps.
 */

/** Adds the current user ("me") to a create-time follower list. */
export function withCreator(followers: string[] | undefined): string[] {
  return followers?.includes("me") === true ? followers : [...(followers ?? []), "me"];
}

/**
 * Bulk counterpart of `withCreator`: every created task, nested `tasks`
 * subtrees included, gets the current user in its `followers`. Items come
 * straight from `--from-file`, so a `followers` that isn't an array is left
 * for the server to reject rather than spread into characters.
 */
export function withCreatorInItems(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items.map((item) => ({
    ...item,
    followers: item.followers === undefined || Array.isArray(item.followers)
      ? withCreator(item.followers as string[] | undefined)
      : item.followers,
    ...(Array.isArray(item.tasks) ? { tasks: withCreatorInItems(item.tasks as Record<string, unknown>[]) } : {}),
  }));
}
