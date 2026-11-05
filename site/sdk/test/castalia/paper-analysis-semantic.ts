/** Generated from the canonical Castalia fixture contract. Do not edit. */

export interface PaperAnalysisSemantic {
  schemaVersion: "castalia.paper-analysis-semantic.v1";
  id: string;
  targetId: string;
  snapshotId: string;
  engine: string;
  engineRevision: string;
  limits: string[];
  status:
    | "not_run"
    | "exhausted"
    | "counterexample_found"
    | "unsupported"
    | "error";
  stopReason: string;
  conclusionBoundary: string;
  createdAt: string;
}
