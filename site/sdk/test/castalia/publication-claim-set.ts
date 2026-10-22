/** Generated from the canonical Castalia fixture contract. Do not edit. */

export interface PublicationClaimSet {
  schemaVersion: "castalia.publication-claim-set.v1";
  id: string;
  revision: string;
  publicationRevision: string;
  extractionStatus:
    | "candidate_partial"
    | "reviewed_partial"
    | "reviewed_complete";
  coverageNote: string;
  claims: {
    id: string;
    statement: string;
    kind:
      | "definition"
      | "axiom"
      | "theorem"
      | "empirical"
      | "model"
      | "hypothesis"
      | "interpretive";
    epistemicGrade: "source_stated" | "derived" | "measured" | "speculative";
    sourceLocator: {
      pages: string;
      section: string;
    };
    reviewState: "candidate" | "confirmed" | "rejected";
    formalizationStatus:
      | "unformalized"
      | "drafted"
      | "checked"
      | "refuted"
      | "uncheckable";
    dependencies: string[];
    leanDeclaration?: string;
  }[];
  createdAt: string;
}
