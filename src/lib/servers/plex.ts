/**
 * Plex API helpers for admin authentication.
 */

const PLEX_HEADERS = {
  'X-Plex-Client-Identifier': 'portalrr',
  'X-Plex-Product': 'Portalrr',
  'X-Plex-Version': '1.0.0',
  Accept: 'application/json',
};

/**
 * Authenticate a user against plex.tv and check if they own the given server.
 * Returns the user's auth token if they are the server owner, null otherwise.
 */
export async function authenticatePlexAdmin(
  serverUrl: string,
  serverToken: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    // Sign in to plex.tv to get the user's auth token
    const signInRes = await fetch('https://plex.tv/users/sign_in.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...PLEX_HEADERS,
      },
      body: new URLSearchParams({
        'user[login]': username,
        'user[password]': password,
      }),
    });

    if (!signInRes.ok) return false;

    const signInData = await signInRes.json();
    const userToken = signInData?.user?.authToken;
    if (!userToken) return false;

    // Get the server's machine identifier using the server admin token
    const identityRes = await fetch(`${serverUrl}/identity`, {
      headers: { 'X-Plex-Token': serverToken, Accept: 'application/json' },
    });

    if (!identityRes.ok) return false;

    const identity = await identityRes.json();
    const machineId = identity?.MediaContainer?.machineIdentifier;
    if (!machineId) return false;

    // Check if this user owns any server with that machine identifier
    const resourcesRes = await fetch('https://plex.tv/api/v2/resources?includeHttps=1', {
      headers: { 'X-Plex-Token': userToken, ...PLEX_HEADERS },
    });

    if (!resourcesRes.ok) return false;

    const resources = await resourcesRes.json();
    return resources.some(
      (r: { clientIdentifier: string; owned: boolean }) =>
        r.clientIdentifier === machineId && r.owned === true
    );
  } catch {
    return false;
  }
}
