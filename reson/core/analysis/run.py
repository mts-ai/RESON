"""Run result containers for RESON."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, List, Any
from pathlib import Path
import json

import pandas as pd

from reson.core.stats import ReplaceVocabStats, Vocab, Alphabet


@dataclass(frozen=True)
class RESONRun:
    """Immutable result of a single RESON analysis run."""

    name: str
    summary: Dict[str, object]
    metrics: pd.DataFrame
    manifest: pd.DataFrame
    vocab: Vocab
    alphabet: Alphabet
    replacements: Optional[ReplaceVocabStats]
    artifacts: Dict[str, str]
    config: Dict[str, object]
    meta: Dict[str, object]
    
    def __str__(self) -> str:
        lines = []
        lines.append(f" Total time: {self.summary['Number of hours']}")
        lines.append(f" Number of examples: {self.summary['Number of utterances']}")
        dur = self.summary["Duration info"]
        dur_stats = [
            f"• Mean: {dur['mean']}",
            f"• Std: {dur['std']}",
            f"• Min: {dur['min']}",
            f"• 25%: {dur['25%']}",
            f"• Median: {dur['50%']}",
            f"• 75%: {dur['75%']}",
            f"• Max: {dur['max']}",
        ]
        lines.append(
            "   └─ Duration statistics (seconds):\n      " + "\n      ".join(dur_stats)
        )
        lines.append(f"Vocabulary size: {self.summary['Vocabulary size']}")
        lines.append(f"Alphabet size: {self.summary['Alphabet size']}")
        
        dt = self.summary.get("Duration types", {}) or {}
        if dt:
            dt_str = ", ".join([f"{k}: {v}" for k, v in dt.items()])
            lines.append(f"Duration distribution: {dt_str}")
        
        ru = self.alphabet.russian.chars
        en = self.alphabet.english.chars
        num = self.alphabet.numeric.chars
        other = self.alphabet.other.chars
        lines.append("Alphabet by categories:")
        lines.append(f"   ├─ Russian ({len(ru)}): {', '.join(ru)}")
        lines.append(f"   ├─ English ({len(en)}): {', '.join(en)}")
        lines.append(f"   ├─ Numbers ({len(num)}): {', '.join(num)}")
        lines.append(f"   └─ Other ({len(other)}): {', '.join(other)}")

        repl_total = self.summary.get("Replacements total")
        repl_by_field = self.summary.get("Replacements by field")
        if repl_total is not None:
            lines.append(f"Replacement vocabulary — total triggers: {int(repl_total)}")
        if isinstance(repl_by_field, dict) and repl_by_field:
            fields_str = ", ".join([f"{k}: {v}" for k, v in repl_by_field.items()])
            lines.append(f"   └─ By fields: {fields_str}")

        # Метрики
        if isinstance(self.metrics, pd.DataFrame) and not self.metrics.empty:
            lines.append("Metrics:")
            mwa = self.vocab.mean_recall
            if mwa is not None:
                lines.append(f"   MWA: {mwa:.2f}%")
            # Добавляем все метрики из self.metrics
            for idx, row in self.metrics.reset_index().iterrows():
                metric_name = row.get("index", None)
                if metric_name is None:
                    metric_name = idx
                val = None
                for key in ("VALUE", "value"):
                    if key in row:
                        v = row.get(key)
                        if v is not None:
                            val = float(v)
                            break
                if val is not None:
                    line = f"   🎯 {metric_name}: {val:.2f}"
                else:
                    line = f"   🎯 {metric_name}"
                if str(metric_name).upper() == "WER":
                    ins = row.get("INS")
                    del_ = row.get("DEL")
                    sub = row.get("SUB")
                    parts = []
                    for label, v in ("INS", ins), ("DEL", del_), ("SUB", sub):
                        if v is not None:
                            parts.append(f"{label}: {float(v):.0f}")
                    if parts:
                        line += " (" + ", ".join(parts) + ")"
                lines.append(line)

        return "\n".join(lines)

    def to_dict(self) -> Dict[str, object]:
        return {
            "name": self.name,
            "metrics": self.metrics.reset_index().to_dict("records"),
            "vocab": self.vocab.data.to_dict("records"),
            "alphabet": self.alphabet.data.to_dict("records"),
            "replacements": (
                None
                if self.replacements is None
                else {
                    "vocab": self.replacements.vocab,
                    "fields": self.replacements.fields,
                    "words": self.replacements.words,
                    "examples": self.replacements.examples,
                }
            ),
            "summary": self.summary,
            "artifacts": self.artifacts,
            "config": self.config,
            "meta": self.meta,
            "manifest": self.manifest.to_dict("records"),
            "schema_version": "1.0",
        }

    @classmethod
    def from_dict(cls, payload: Dict[str, Any]) -> "RESONRun":
        name: str = payload.get("name", "Unnamed")
        
        metrics_rec = payload.get("metrics", [])
        metrics_df = pd.DataFrame(metrics_rec)

        if not metrics_df.empty:
            if "index" in metrics_df.columns:
                metrics_df = metrics_df.set_index("index")
       
        # manifest
        manifest_df = pd.DataFrame(payload.get("manifest", []))

        # vocab
        vocab_rec = payload.get("vocab", [])
        vocab_obj = Vocab(pd.DataFrame(vocab_rec))

        from reson.core.analysis.vocab_scoring import enrich_vocab, vocab_needs_enrichment

        if vocab_needs_enrichment(vocab_obj) and not manifest_df.empty:
            repl_payload_early = payload.get("replacements")
            repl_early = None
            if repl_payload_early is not None:
                repl_early = ReplaceVocabStats(
                    vocab=repl_payload_early.get("vocab", {}),
                    fields=repl_payload_early.get("fields", {}),
                    words=repl_payload_early.get("words", {}),
                    examples=repl_payload_early.get("examples", {}),
                )
            vocab_obj = enrich_vocab(vocab_obj, manifest_df, repl_early)

        # alphabet
        alphabet_rec = payload.get("alphabet", [])
        alphabet_obj = Alphabet.from_records(alphabet_rec)
        
        # replacements
        repl_payload = payload.get("replacements")
        if repl_payload is None:
            replacements_obj = None
        else:
            replacements_obj = ReplaceVocabStats(
                vocab=repl_payload.get("vocab", {}),
                fields=repl_payload.get("fields", {}),
                words=repl_payload.get("words", {}),
                examples=repl_payload.get("examples", {}),
            )
        summary = payload.get("summary", {})
        artifacts = payload.get("artifacts", {})
        config = payload.get("config", {})
        meta = payload.get("meta", {})
        return cls(
            name=name,
            summary=summary,
            metrics=metrics_df,
            manifest=manifest_df,
            vocab=vocab_obj,
            alphabet=alphabet_obj,
            replacements=replacements_obj,
            artifacts=artifacts,
            config=config,
            meta=meta,
        )

    def to_json(self, output_fp: str) -> str:
        payload = self.to_dict()
        out_path = Path(output_fp)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        return str(out_path)

    def report(self, output_html: str = "single_report.html", *, force_rebuild: bool = False) -> str:
        """Generate interactive single-run HTML report for this run.

        This is a convenience wrapper around
        :func:`reson.reporting.render_single_report_html`.
        Import is done lazily to keep core analysis layer lightweight.

        Args:
            output_html: Output path for generated report.
            force_rebuild: If True, forces Vite frontend rebuild by setting
                ``RESON_FORCE_REBUILD=1`` for the current call.

        Returns:
            Path to generated HTML report.
        """
        from reson.reporting import render_single_report_html
        import os

        if not force_rebuild:
            return render_single_report_html(self, output_html)

        prev_value = os.environ.get("RESON_FORCE_REBUILD")
        os.environ["RESON_FORCE_REBUILD"] = "1"
        try:
            return render_single_report_html(self, output_html)
        finally:
            if prev_value is None:
                os.environ.pop("RESON_FORCE_REBUILD", None)
            else:
                os.environ["RESON_FORCE_REBUILD"] = prev_value

    @classmethod
    def from_json(cls, input_fp: str) -> "RESONRun":
        with open(input_fp, "r", encoding="utf-8") as f:
            payload = json.load(f)
        return cls.from_dict(payload)
