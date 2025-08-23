// File path: /app/api/health/route.js

export async function GET(request) {
  // This function responds to GET requests at /api/health
  return new Response('OK', { status: 200 });
}
