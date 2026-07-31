import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { authenticate, errorResponse } from "@/lib/server/auth";
import { SYNC_SCHEMA_VERSION } from "@/lib/server/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  return {
    version: data.version ?? null,
    schemaVersion: data.schemaVersion ?? SYNC_SCHEMA_VERSION,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticate(request);
    const groupIds = actor.groupIds;
    const [globalSync, userSync, ...groupSyncs] = await Promise.all([
      adminDb.collection("sync").doc("global").get(),
      adminDb.collection("sync").doc(`user_${actor.uid}`).get(),
      ...groupIds.map((id) => adminDb.collection("sync").doc(`group_${id}`).get()),
    ]);

    return NextResponse.json({
      schemaVersion: SYNC_SCHEMA_VERSION,
      global: serialize(globalSync),
      user: serialize(userSync),
      groups: Object.fromEntries(groupIds.map((id, index) => [id, serialize(groupSyncs[index])])),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
