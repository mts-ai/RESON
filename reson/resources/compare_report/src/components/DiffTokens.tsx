import type { DiffToken } from '../utils/wordErrorHelpers';

interface DiffTokensProps {
  tokens?: DiffToken[];
  reference: string;
  prediction: string;
}

function buildFallbackTokens(
  reference: string,
  hypothesis: string,
): DiffToken[] {
  const refWords = reference ? reference.trim().split(/\s+/) : [];
  const hypWords = hypothesis ? hypothesis.trim().split(/\s+/) : [];

  if (refWords.length === 0 && hypWords.length === 0) return [];

  const tokens: DiffToken[] = [];
  const maxLen = Math.max(refWords.length, hypWords.length);

  for (let i = 0; i < maxLen; i += 1) {
    const refWord = refWords[i];
    const hypWord = hypWords[i];

    if (refWord && hypWord && refWord === hypWord) {
      tokens.push({ word: refWord, type: 'equal' });
    } else if (refWord && hypWord) {
      tokens.push({ word: refWord, type: 'sub_del' });
      tokens.push({ word: hypWord, type: 'sub_ins' });
    } else if (refWord) {
      tokens.push({ word: refWord, type: 'del' });
    } else if (hypWord) {
      tokens.push({ word: hypWord, type: 'ins' });
    }
  }

  return tokens;
}

export function DiffTokensView({ tokens, reference, prediction }: DiffTokensProps) {
  const normalized = tokens && tokens.length > 0
    ? tokens
    : buildFallbackTokens(reference, prediction);

  return (
    <span className="reson-diff-tokens">
      {normalized.map((item, idx) => (
        <span
          key={`diff-${idx}-${item.word}-${item.type}`}
          className={`reson-diff-token reson-diff-token--${item.type}`}
        >
          {item.word}
        </span>
      ))}
    </span>
  );
}
