import { NextResponse } from "next/server";
import {
  fetchMindsReplyForAlias,
  sendPolicyProposalRequest,
} from "@/lib/minds";
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

/**
 * Reads proposals. Any pending proposal whose Mind reply has since arrived
 * is materialized here (lazy fetch) so the dashboard always shows the
 * latest state without a serverless function waiting on the Mind.
 */
export async function GET() {
  const ws = await currentWorkspaceId();
  const proposals = await getProposals(ws);
  const materialized = await Promise.all(
    proposals.map(async (proposal) => {
      if (
        proposal.status === "pending" &&
        proposal.mindAlias &&
        !proposal.content
      ) {
        const reply = await fetchMindsReplyForAlias(proposal.mindAlias);
        if (reply.reply) {
          proposal.content = reply.reply;
          proposal.summary = reply.reply.slice(0, 160);
          await saveProposal(ws, proposal);
        }
      }
      return proposal;
    }),
  );
  return NextResponse.json({ proposals: materialized });
}

/**
 * Asks the Mind to propose a policy update. Because the Mind replies
 * asynchronously (~1–2 min), this stores a pending proposal immediately and
 * returns — the reply is materialized on the next read. The creator still
 * approves or rejects; the Mind never edits the policy on its own.
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
    .map((incident) => `${incident.status}: ${incident.decisionNote}`);

  const result = await sendPolicyProposalRequest(policy, decisions, ws);
  if (!result.alias) {
    return NextResponse.json(
      { error: result.error ?? "Your Mind could not be reached." },
      { status: 502 },
    );
  }

  const proposal: PolicyProposal = {
    id: newId("prp"),
    content: "",
    summary: "",
    createdAt: new Date().toISOString(),
    status: "pending",
    mindAlias: result.alias,
  };
  await saveProposal(ws, proposal);
  return NextResponse.json(
    { proposal, thinking: true, message: "Your Mind is drafting a proposal…" },
    { status: 201 },
  );
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
    if (!proposal.content) {
      return NextResponse.json(
        { error: "Your Mind is still drafting this proposal — check back shortly." },
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
