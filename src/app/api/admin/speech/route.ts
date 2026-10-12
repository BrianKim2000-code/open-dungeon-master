export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ error: "Audio generation has been removed in this simplified build." }, { status: 410 });
}
export async function POST() {
  return Response.json({ error: "Audio generation has been removed." }, { status: 410 });
}
