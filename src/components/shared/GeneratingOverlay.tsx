import React from 'react';
import { label } from '../../utils/labels';

/** Blocking loader shown while Dynamic Assess questions generate, so a stale tree can't be edited and saved over the job's result; Cancel stops waiting (the job keeps running). */
export function GeneratingOverlay({ open, onCancel, stopping }: { open: boolean; onCancel?: () => void; stopping?: boolean }) {
  if (!open) return null;
  return (
    <div className="ce-modal-scrim ce-generating" role="status" aria-live="polite">
      <div className="ce-generating-card">
        <span className="ce-spinner" aria-hidden="true" />
        <p className="ce-generating-title">{label('messages.info.dynamicAssessGeneratingTitle', 'Generating questions')}</p>
        <p className="ce-generating-sub">
          {label(
            'messages.info.dynamicAssessGeneratingSub',
            'Picking questions from the pool for the selected skills and difficulty. This usually takes a few seconds.',
          )}
        </p>
        {onCancel && (
          // Disabled once pressed: the wait ends at its next check, within a few seconds.
          <button type="button" className="ce-btn ghost" onClick={onCancel} disabled={stopping}>
            {label('ui.dynamicAssessCancelGenerating', 'Cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

export default GeneratingOverlay;
