/**
 * Jellyfin API helper for password operations.
 * API keys cannot be used for password changes (Jellyfin bug #10094),
 * so we authenticate as the admin user to get an auth token.
 */

const CLIENT_HEADERS = {
  'X-Emby-Authorization': 'MediaBrowser Client="Portalrr", Device="Server", DeviceId="portalrr-server", Version="1.0.0"',
};

export async function getJellyfinAuthToken(
  serverUrl: string,
  adminUsername: string,
  adminPassword: string
): Promise<string> {
  const res = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...CLIENT_HEADERS,
    },
    body: JSON.stringify({
      Username: adminUsername,
      Pw: adminPassword,
    }),
  });

  if (!res.ok) {
    throw new Error(`Jellyfin auth failed: ${res.status}`);
  }

  const data = await res.json();
  return data.AccessToken;
}

export async function changeJellyfinPassword(
  serverUrl: string,
  authToken: string,
  jellyfinUserId: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${serverUrl}/Users/${jellyfinUserId}/Password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': `MediaBrowser Client="Portalrr", Device="Server", DeviceId="portalrr-server", Version="1.0.0", Token="${authToken}"`,
    },
    body: JSON.stringify({
      NewPw: newPassword,
      ResetPassword: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Jellyfin password change failed: ${res.status} ${errText}`);
  }
}

export async function resetJellyfinPassword(
  serverUrl: string,
  authToken: string,
  jellyfinUserId: string
): Promise<void> {
  const res = await fetch(`${serverUrl}/Users/${jellyfinUserId}/Password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': `MediaBrowser Client="Portalrr", Device="Server", DeviceId="portalrr-server", Version="1.0.0", Token="${authToken}"`,
    },
    body: JSON.stringify({
      ResetPassword: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Jellyfin password reset failed: ${res.status} ${errText}`);
  }
}

export async function authenticateJellyfinAdmin(
  serverUrl: string,
  username: string,
  password: string
): Promise<{ isAdmin: boolean; userId: string } | null> {
  try {
    const res = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...CLIENT_HEADERS,
      },
      body: JSON.stringify({ Username: username, Pw: password }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      isAdmin: data.User?.Policy?.IsAdministrator === true,
      userId: data.User?.Id,
    };
  } catch {
    return null;
  }
}

export async function findJellyfinUserByName(
  serverUrl: string,
  apiKey: string,
  username: string
): Promise<string | null> {
  const res = await fetch(`${serverUrl}/Users`, {
    headers: { 'X-MediaBrowser-Token': apiKey },
  });

  if (!res.ok) return null;

  const users = await res.json();
  const match = users.find(
    (u: { Name: string }) => u.Name.toLowerCase() === username.toLowerCase()
  );
  return match?.Id || null;
}
