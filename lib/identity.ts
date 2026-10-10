import type { SurpriseBasics } from "./types";

/**
 * Canonical read/update surface for "who this surprise is for and from"
 * (Phase 8's SurpriseIdentity). senderName/recipientName on SurpriseBasics
 * remain the single stored source of truth — every template, the export
 * pipeline, and the viewer already read those two fields exclusively (no
 * other field anywhere else on SurpriseData duplicates a name). This module
 * exists so the identity step (and only the identity step) is the one place
 * that also manages the saved-person references alongside them, instead of
 * every screen re-deriving "recipient" from raw basics fields differently.
 */
export interface SurpriseIdentity {
  recipient: {
    id?: string;
    displayName: string;
    nickname?: string;
    relationship?: string;
  };
  sender: {
    profileId?: string;
    displayName: string;
    signOff?: string;
  };
}

export function readIdentity(basics: Partial<SurpriseBasics>): SurpriseIdentity {
  return {
    recipient: {
      id: basics.recipientId,
      displayName: basics.recipientName || "",
      nickname: basics.recipientNickname,
      relationship: basics.recipientRelationship,
    },
    sender: {
      profileId: basics.senderProfileId,
      displayName: basics.senderName || "",
      signOff: basics.senderSignOff,
    },
  };
}

/** Returns the SurpriseBasics field patch for an identity change — callers pass this straight to their existing onUpdate(Partial<SurpriseBasics>). */
export function identityToBasicsPatch(
  identity: Partial<SurpriseIdentity>,
): Partial<SurpriseBasics> {
  const patch: Partial<SurpriseBasics> = {};
  if (identity.recipient) {
    patch.recipientName = identity.recipient.displayName;
    patch.recipientId = identity.recipient.id;
    patch.recipientNickname = identity.recipient.nickname;
    patch.recipientRelationship = identity.recipient.relationship;
  }
  if (identity.sender) {
    patch.senderName = identity.sender.displayName;
    patch.senderProfileId = identity.sender.profileId;
    patch.senderSignOff = identity.sender.signOff;
  }
  return patch;
}

/** "For Denyal · From Cai" — the compact identity line every later step shows instead of re-asking. */
export function identitySummaryLine(basics: Partial<SurpriseBasics>): string {
  const identity = readIdentity(basics);
  const recipient = identity.recipient.displayName.trim();
  const sender = identity.sender.displayName.trim();
  if (!recipient && !sender) return "";
  if (!sender) return `For ${recipient}`;
  if (!recipient) return `From ${sender}`;
  return `For ${recipient} · From ${sender}`;
}
