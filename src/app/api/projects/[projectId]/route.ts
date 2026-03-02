import { NextResponse } from "next/server";
import { getProjectWithSketch } from "@/app/(protected)/tools/disegna-schema/actions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const data = await getProjectWithSketch(projectId);

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
