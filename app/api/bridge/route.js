export async function GET(request) {
  return forward(request);
}

export async function POST(request) {
  return forward(request);
}

async function forward(request) {
  const target = process.env.APPS_SCRIPT_URL;
  if (!target) {
    return Response.json({ ok: false, error: "APPS_SCRIPT_URL is not configured" }, { status: 500 });
  }

  const url = new URL(target);
  const incoming = new URL(request.url);
  incoming.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const init = { method: request.method, headers: { Accept: "application/json" } };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.headers["Content-Type"] = request.headers.get("content-type") || "application/json";
    init.body = await request.text();
  }

  const response = await fetch(url.toString(), init);
  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8" }
  });
}
