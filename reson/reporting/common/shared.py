"""Shared helpers for reporting payload builders and HTML bundling."""

from __future__ import annotations

import base64
import difflib
import gzip
import json
import math
import os
import re
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


def humanize_hours(hours: float | None) -> str:
    """Convert hours to compact human-readable string."""
    try:
        if hours is None:
            return "н/д"
        total_minutes = int(round(float(hours) * 60))
        return f"{total_minutes // 60}ч {total_minutes % 60}м"
    except Exception:
        return "н/д"


def extract_float_value(value: Any, default: float = 0.0) -> float:
    """Safe conversion to float."""
    try:
        if value is None or (isinstance(value, str) and value.strip() == ""):
            return default
        return float(value)
    except Exception:
        return default


def is_missing_metric_value(value: Any) -> bool:
    """True when a metrics cell is absent or NaN."""
    return value is None or (isinstance(value, float) and math.isnan(value))


def optional_metric_float(value: Any) -> float | None:
    """Convert metric cell to float or None for JSON-friendly payloads."""
    if is_missing_metric_value(value):
        return None
    return extract_float_value(value, 0.0)


def optional_metric_int(value: Any) -> int | None:
    """Convert metric cell to int or None for JSON-friendly payloads."""
    if is_missing_metric_value(value):
        return None
    return extract_int_value(value, 0)


def extract_int_value(value: Any, default: int = 0) -> int:
    """Safe conversion to int with support for textual values."""
    try:
        if value is None or isinstance(value, bool):
            return default
        if isinstance(value, str):
            match = re.search(r"\d+", value.replace(",", ""))
            if match:
                return int(match.group(0))
        return int(value)
    except Exception:
        try:
            return int(float(value))
        except Exception:
            return default


def format_hours_to_hhmmss(hours: float) -> str:
    """Convert hours float into H:MM:SS."""
    safe_hours = max(float(hours or 0.0), 0.0)
    total_seconds = int(round(safe_hours * 3600.0))
    hh = total_seconds // 3600
    mm = (total_seconds % 3600) // 60
    ss = total_seconds % 60
    return f"{hh}:{mm:02d}:{ss:02d}"


def normalize_duration_value(value: Any) -> str | None:
    """Normalize duration to H:MM:SS when possible."""
    if value is None:
        return None
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        match = re.fullmatch(r"(\d{1,2}):(\d{1,2}):(\d{1,2})", raw)
        if match:
            return f"{int(match.group(1))}:{int(match.group(2)):02d}:{int(match.group(3)):02d}"
        try:
            return format_hours_to_hhmmss(float(raw))
        except Exception:
            return None
    if isinstance(value, (int, float)):
        return format_hours_to_hhmmss(float(value))
    return None


def generate_word_diff_tokens(reference: str, hypothesis: str) -> List[Dict[str, str]]:
    """Generate structured diff tokens for frontend highlighting."""
    ref_words = str(reference or "").split()
    hyp_words = str(hypothesis or "").split()

    matcher = difflib.SequenceMatcher(None, ref_words, hyp_words)
    tokens: List[Dict[str, str]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for i in range(i1, i2):
                tokens.append({"word": ref_words[i], "type": "equal"})
        elif tag == "delete":
            for i in range(i1, i2):
                tokens.append({"word": ref_words[i], "type": "del"})
        elif tag == "insert":
            for j in range(j1, j2):
                tokens.append({"word": hyp_words[j], "type": "ins"})
        elif tag == "replace":
            ref_len = i2 - i1
            hyp_len = j2 - j1
            if ref_len == hyp_len:
                for k in range(ref_len):
                    tokens.append({"word": ref_words[i1 + k], "type": "sub_del"})
                    tokens.append({"word": hyp_words[j1 + k], "type": "sub_ins"})
            elif ref_len > hyp_len:
                for i in range(i1, i1 + (ref_len - hyp_len)):
                    tokens.append({"word": ref_words[i], "type": "del"})
                for k in range(hyp_len):
                    tokens.append({"word": ref_words[i1 + (ref_len - hyp_len) + k], "type": "sub_del"})
                    tokens.append({"word": hyp_words[j1 + k], "type": "sub_ins"})
            else:
                for k in range(ref_len):
                    tokens.append({"word": ref_words[i1 + k], "type": "sub_del"})
                    tokens.append({"word": hyp_words[j1 + k], "type": "sub_ins"})
                for j in range(j1 + ref_len, j2):
                    tokens.append({"word": hyp_words[j], "type": "ins"})
    return tokens


def compute_f1_score_from_vocab(
    recall: float,
    precision: float,
    f1_score: float = 0.0,
) -> float:
    """Derive F1 when the stored value is missing or zero."""
    if f1_score == 0.0 and recall > 0 and precision > 0:
        denom = recall + precision
        return 2.0 * recall * precision / denom if denom > 0 else (recall + precision) / 2.0
    if f1_score == 0.0:
        return (recall + precision) / 2.0
    return f1_score


def compute_f1_score_from_record(rec: Dict[str, Any]) -> float:
    """F1 from a vocab row dict (single/compare payloads)."""
    return compute_f1_score_from_vocab(
        extract_float_value(rec.get("recall"), 0.0),
        extract_float_value(rec.get("precision"), 0.0),
        extract_float_value(rec.get("f1_score"), 0.0),
    )


def duration_type_from_seconds(duration: float) -> str:
    """Bucket utterance duration for compare/single UI."""
    if duration < 5:
        return "short"
    if duration > 30:
        return "long"
    return "normal"

def run_vite_build(project_dir: str) -> str:
    """Build Vite project when output is absent or stale."""
    out_dir = os.path.join(project_dir, "build")
    index_fp = os.path.join(out_dir, "index.html")

    def _inline_js_bundle_count() -> int:
        assets_dir = os.path.join(out_dir, "assets")
        js_files = list(Path(assets_dir).glob("*.js")) if os.path.isdir(assets_dir) else []
        return len(js_files)

    def _latest_mtime(paths: List[str]) -> float:
        existing = [p for p in paths if os.path.exists(p)]
        if not existing:
            return 0.0
        return max(os.path.getmtime(p) for p in existing)

    src_root = os.path.join(project_dir, "src")
    latest_src_mtime = 0.0
    if os.path.isdir(src_root):
        for root, _, files in os.walk(src_root):
            for name in files:
                fp = os.path.join(root, name)
                try:
                    latest_src_mtime = max(latest_src_mtime, os.path.getmtime(fp))
                except OSError:
                    continue

    latest_config_mtime = _latest_mtime(
        [
            os.path.join(project_dir, "package.json"),
            os.path.join(project_dir, "package-lock.json"),
            os.path.join(project_dir, "vite.config.ts"),
            os.path.join(project_dir, "tsconfig.json"),
            os.path.join(project_dir, "tsconfig.app.json"),
        ]
    )
    latest_input_mtime = max(latest_src_mtime, latest_config_mtime)
    build_mtime = os.path.getmtime(index_fp) if os.path.exists(index_fp) else 0.0
    force_rebuild = os.environ.get("RESON_FORCE_REBUILD", "").strip() == "1"
    multi_chunk_build = _inline_js_bundle_count() > 1
    needs_build = (
        force_rebuild
        or (not os.path.exists(index_fp))
        or (build_mtime < latest_input_mtime)
        or multi_chunk_build
    )

    if not needs_build:
        return out_dir
    build_env = os.environ.copy()
    build_env["RESON_INLINE_HTML"] = "1"
    try:
        if os.path.exists(os.path.join(project_dir, "package-lock.json")):
            subprocess.run(["npm", "ci"], cwd=project_dir, check=True, capture_output=True, env=build_env)
        else:
            subprocess.run(["npm", "install"], cwd=project_dir, check=True, capture_output=True, env=build_env)
        subprocess.run(["npm", "run", "build"], cwd=project_dir, check=True, capture_output=True, env=build_env)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"npm not found and pre-built files are missing in {out_dir}. "
            "Please install nodejs and npm to build the report manually, or ensure pre-built files are present."
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Vite build failed: {exc}") from exc

    if not os.path.exists(index_fp):
        raise FileNotFoundError(f"Vite build output not found: {index_fp}")

    assets_dir = os.path.join(out_dir, "assets")
    js_files = list(Path(assets_dir).glob("*.js")) if os.path.isdir(assets_dir) else []
    if len(js_files) != 1:
        names = ", ".join(p.name for p in js_files) or "(none)"
        raise RuntimeError(
            f"Expected exactly one JS bundle for inline HTML report, found {len(js_files)}: {names}. "
            "Ensure RESON_INLINE_HTML=1 is set during vite build."
        )
    return out_dir


_GUNZIP_JS = Path(__file__).with_name("gunzip_sync.js")
_GZIP_PAYLOAD_THRESHOLD = 24 * 1024


def _inject_payload_before_app_script(html: str, data_js: str) -> str:
    """Put payload in a classic script immediately before the React bundle.

    Keeping multi-megabyte JSON out of ``<head>`` leaves ``<meta charset>`` in
    the first 1024 bytes (required by Safari) and lets the boot markup paint
    before gzip decode runs.
    """
    module_script = re.search(r"<script[^>]*type=[\"']module[\"'][^>]*>", html, flags=re.IGNORECASE)
    if module_script:
        insert_at = module_script.start()
        return html[:insert_at] + data_js + "\n" + html[insert_at:]
    classic_script = re.search(r"<script\b", html, flags=re.IGNORECASE)
    if classic_script:
        insert_at = classic_script.start()
        return html[:insert_at] + data_js + "\n" + html[insert_at:]
    if "</body>" in html:
        return html.replace("</body>", data_js + "\n</body>", 1)
    return html + data_js


def encode_report_payload_script(data_payload: Dict[str, Any], data_global_name: str) -> str:
    """Serialize report JSON, gzip-compressing payloads that would choke iOS Safari."""
    json_text = json.dumps(data_payload, ensure_ascii=False, separators=(",", ":"))
    json_bytes = json_text.encode("utf-8")
    if len(json_bytes) < _GZIP_PAYLOAD_THRESHOLD:
        return f"<script>{data_global_name} = {json_text};</script>"

    b64 = base64.b64encode(gzip.compress(json_bytes, compresslevel=9)).decode("ascii")
    inflater = _GUNZIP_JS.read_text(encoding="utf-8")
    return (
        "<script>\n"
        f"window.__RESON_DATA_GZ__ = {json.dumps(b64)};\n"
        f"{inflater}\n"
        f"{data_global_name} = JSON.parse(resonGunzipUtf8(window.__RESON_DATA_GZ__));\n"
        "</script>"
    )


def _inject_payload_after_charset(html: str, data_js: str) -> str:
    """Insert the data script after ``<meta charset>`` (legacy head injection)."""
    charset = re.search(r"<meta\s+charset=[^>]*>", html, flags=re.IGNORECASE)
    if charset:
        insert_at = charset.end()
        return html[:insert_at] + "\n" + data_js + html[insert_at:]
    if "</head>" in html:
        return html.replace("</head>", data_js + "\n</head>", 1)
    return re.sub(r"<head>(\s*)", lambda m: f"<head>{m.group(1)}\n{data_js}\n", html, count=1)


def inline_build_to_single_html(
    build_dir: str,
    data_payload: Dict[str, Any],
    output_html: str,
    data_global_name: str,
) -> str:
    """Inline JS/CSS and inject payload under requested global name."""
    index_fp = os.path.join(build_dir, "index.html")
    html = Path(index_fp).read_text(encoding="utf-8")
    data_js = encode_report_payload_script(data_payload, data_global_name)

    def _css_repl(match: re.Match[str]) -> str:
        href = match.group(1)
        normalized_href = href[2:] if href.startswith("./") else (href[1:] if href.startswith("/") else href)
        css_fp = os.path.join(build_dir, normalized_href)
        if os.path.exists(css_fp):
            return f"<style>\n{Path(css_fp).read_text(encoding='utf-8')}\n</style>"
        return match.group(0)

    html = re.sub(r"<link[^>]+href=\"(\.?/?assets/[^\"\?]+\.css)\"[^>]*>", _css_repl, html)
    html = re.sub(r"<link[^>]+rel=\"modulepreload\"[^>]*>\s*", "", html)

    def _js_repl(match: re.Match[str]) -> str:
        src = match.group(1)
        normalized_src = src[2:] if src.startswith("./") else (src[1:] if src.startswith("/") else src)
        js_fp = os.path.join(build_dir, normalized_src)
        if os.path.exists(js_fp):
            return f"<script type=\"module\">\n{Path(js_fp).read_text(encoding='utf-8')}\n</script>"
        return match.group(0)

    html = re.sub(r"<script[^>]*type=\"module\"[^>]*src=\"(\.?/?assets/[^\"\?]+\.js)\"[^>]*></script>", _js_repl, html)

    if re.search(r"<script[^>]+src=\"(\.?/?assets/[^\"\?]+\.js)\"", html):
        raise RuntimeError(
            "Vite build left external JS references in index.html. "
            "Rebuild with RESON_INLINE_HTML=1 (automatic via reson report single)."
        )

    html = _inject_payload_before_app_script(html, data_js)

    Path(output_html).parent.mkdir(parents=True, exist_ok=True)
    Path(output_html).write_text(html, encoding="utf-8")
    return str(Path(output_html).resolve())
