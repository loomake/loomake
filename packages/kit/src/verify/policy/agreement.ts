import type { Agreement, RequirementId } from '@loomake/core';

export type AgreementDecision = {
  blockingQuestions: string[];
  pendingRequirements: RequirementId[];
  unapprovedAssumptions: string[];
  missingSources: RequirementId[];
};

/** 合意に基づく停止・警告条件を判定する。表示とI/Oは呼び出し側が担当する。 */
export function evaluateAgreement(model: Agreement): AgreementDecision {
  return {
    blockingQuestions: model.questions.filter((q) => q.blocking && !q.answer).map((q) => q.id),
    pendingRequirements: model.requirements.filter((r) => r.state === '確認待ち').map((r) => r.id),
    unapprovedAssumptions: model.assumptions.filter((a) => !a.approval).map((a) => a.id),
    missingSources: model.requirements.filter((r) => !r.source).map((r) => r.id),
  };
}
