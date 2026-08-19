import { NextResponse } from "next/server";
import { proposePolicyUpdate } from "@/lib/minds";
import { newId } from "@/lib/ids";
import {
  getIncidents,
  getPolicy,
  getProposals,
  savePolicy,
  saveProposal,
} from "@/lib/store";
import { currentWorkspaceId } from "@/lib/workspace";
import type { PolicyProposal } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ws = await currentWorkspaceId();
  return NextResponse.json({ proposals: await getProposals(ws) });
}

/**
 * Asks the Mind to propose a policy update. The proposal is stored as
 * pending; the creator approves or rejects it — the Mind never edits the
 * policy on its own.
 */
export async function POST() {
  const ws = await currentWorkspaceId();
  const pending = (await getProposals(ws)).filter(
    (proposal) => proposal.status === "pending",
  );
  if (pending.length > 0) {
    return NextResponse.json(
      { error: "A proposal is already awaiting your decision." },
      { status: 409 },
    );
  }

  const policy = await getPolicy(ws);
  const incidents = await getIncidents(ws);
  const decisions = incidents
    .filter(
      (incident) =>
        (incident.status === "resolved" || incident.status === "dismissed") &&
        incident.decisionNote,
    )
    .map(
      (incident) =>
        `${incident.status}: ${incident.decisionNote}`,
    );

  const reply = await proposePolicyUpdate(policy, decisions, ws);
  if (!reply.reply) {
    return NextResponse.json(
      {
        error:
          reply.error ??
          "Your Mind did not reply yet — try again in a few seconds.",
      },
      { status: 502 },
    );
  }

  const proposal: PolicyProposal = {
    id: newId("prp"),
    content: reply.reply,
    summary: reply.reply.slice(0, 160),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  await saveProposal(ws, proposal);
  return NextResponse.json({ proposal }, { status: 201 });
}

/**
 * Approves or rejects a pending proposal. Approving applies the proposed
 * text as the active policy.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      approve?: unknown;
    };
    if (typeof body.id !== "string") {
      return NextResponse.json({ error: "Proposal id is required." }, { status: 400 });
    }
    const ws = await currentWorkspaceId();
    const proposals = await getProposals(ws);
    const proposal = proposals.find((item) => item.id === body.id);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }
    if (proposal.status !== "pending") {
      return NextResponse.json(
        { error: "This proposal was already decided." },
        { status: 409 },
      );
    }

    if (body.approve === true) {
      proposal.status = "accepted";
      await saveProposal(ws, proposal);
      const policy = await savePolicy(ws, proposal.content);
      return NextResponse.json({ proposal, policy });
    }

    proposal.status = "rejected";
    await saveProposal(ws, proposal);
    return NextResponse.json({ proposal });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
