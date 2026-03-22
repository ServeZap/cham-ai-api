/**
 * Auth Hook
 *
 * JWT authentication hook for protected routes
 */

export async function authHook(request: any, reply: any) {
  // Skip auth for public endpoints
  const skipPaths = ['/api/v1/voice/converse', '/api/v1/calls/inbound'];

  if (skipPaths.some((path) => request.url?.startsWith(path))) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
}
