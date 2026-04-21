import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { listUsers, updateUserStatus, updateUserRole, getUserByGoogleId, type UserStatus, type UserRole } from "@/lib/db";
import { sendApprovalNotification } from "@/lib/email";

type AnySession = { user?: Record<string, unknown> } | null;

function isAdmin(session: AnySession) {
  return session?.user?.role === "admin";
}

export async function GET() {
  const session = await getServerSession(authOptions) as AnySession;
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ users: listUsers() });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions) as AnySession;
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as { id: number; status?: UserStatus; role?: UserRole };
  const adminEmail = (session?.user?.email as string | undefined) ?? null;

  if (body.status) {
    const validStatuses: UserStatus[] = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const userBefore = listUsers().find((u) => u.id === body.id);
    updateUserStatus(body.id, body.status, adminEmail);
    if (body.status === "approved" && userBefore?.status !== "approved") {
      sendApprovalNotification({ name: userBefore?.name ?? null, email: userBefore?.email ?? "" }).catch((err) => {
        console.error("Approval notification email failed:", err);
      });
    }
  }

  if (body.role) {
    const validRoles: UserRole[] = ["admin", "user"];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    updateUserRole(body.id, body.role);
  }

  return NextResponse.json({ ok: true });
}
