export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ error: "Voice has been removed in this simplified build." }, { status: 410 });
}
export async function POST() {
  return Response.json({ error: "Voice has been removed in this simplified build." }, { status: 410 });
}
export async function PUT() {
  return Response.json({ error: "Voice has been removed." }, { status: 410 });
}
export async function DELETE() {
  return Response.json({ error: "Voice has been removed." }, { status: 410 });
}
export async function PATCH() {
  return Response.json({ error: "Voice has been removed." }, { status: 410 });
}
