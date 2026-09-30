import { HelpCircle, Sparkles } from 'lucide-react';
import {
  VocabSectionHintBase,
  type VocabHintItem,
} from '../../../../report_shared/VocabSectionHintBase';

interface VocabSectionHintProps {
  isDark: boolean;
  triggerText: string;
  panelTitle: string;
  panelSubtitle: string;
  panelAriaLabel: string;
  items: VocabHintItem[];
  compact?: boolean;
  scrollable?: boolean;
}

export type { VocabHintItem };

export function VocabSectionHint(props: VocabSectionHintProps) {
  return (
    <VocabSectionHintBase
      {...props}
      HelpIcon={HelpCircle}
      SparklesIcon={Sparkles}
    />
  );
}
