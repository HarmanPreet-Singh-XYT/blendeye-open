"""Contract test: the Showrunner action catalog must not drift from the
TypeScript client's action union.

This exists because it *did* drift. The action catalog used to be duplicated
verbatim in two places — the Python agent prompt
(`app/routers/showrunner.py`) and a second copy in the Next.js route
(`web/app/api/showrunner/execute/route.ts`). By the time it was noticed, the
TypeScript copy had four actions the Python prompt had never been told about
(attach_asset, create_asset_record, generate_timeline_moment, switch_view), so
the model could never emit them and the executor code for them was dead.

The duplicate prompt is gone. This test keeps the single remaining source
honest against the client contract that actually executes the actions.
"""

import re
from pathlib import Path

import pytest

from app.routers.showrunner import ExecuteDirectiveResponse

_REPO_ROOT = Path(__file__).resolve().parents[2]
_PY_PROMPT = Path(__file__).resolve().parents[1] / "app" / "routers" / "showrunner.py"
_TS_ACTIONS = _REPO_ROOT / "web" / "lib" / "studio-actions.ts"

# `{"type": "create_character"` — matching the second brace of the f-string
# escaped `{{"type": ...}}` in the prompt template.
_PY_ACTION_RE = re.compile(r'\{"type":\s*"([a-z_]+)"')
_TS_UNION_RE = re.compile(r"export type StudioActionType\s*=\s*(.*?);", re.DOTALL)
_TS_MEMBER_RE = re.compile(r'"([a-z_]+)"')


def _python_prompt_actions() -> set[str]:
    return set(_PY_ACTION_RE.findall(_PY_PROMPT.read_text(encoding="utf-8")))


def _typescript_union_actions() -> set[str]:
    union = _TS_UNION_RE.search(_TS_ACTIONS.read_text(encoding="utf-8"))
    assert union, "could not locate StudioActionType in web/lib/studio-actions.ts"
    return set(_TS_MEMBER_RE.findall(union.group(1)))


@pytest.mark.skipif(
    not _TS_ACTIONS.exists(),
    reason="web/ not present (e.g. running inside the agent-service container image)",
)
def test_python_prompt_covers_every_typescript_action():
    missing = _typescript_union_actions() - _python_prompt_actions()
    assert not missing, (
        "These actions exist in web/lib/studio-actions.ts but are never described "
        f"to the Showrunner model, so it cannot emit them: {sorted(missing)}"
    )


@pytest.mark.skipif(
    not _TS_ACTIONS.exists(),
    reason="web/ not present (e.g. running inside the agent-service container image)",
)
def test_python_prompt_invents_no_unknown_actions():
    unknown = _python_prompt_actions() - _typescript_union_actions()
    assert not unknown, (
        "The Showrunner prompt advertises actions the TypeScript executor has no "
        f"case for, so they would be silently dropped: {sorted(unknown)}"
    )


def test_execute_response_actually_serializes_the_fallback_flag():
    """The Web route branches on `_fallback` to decide whether to show the
    model's answer or fall through to the deterministic engine.

    Declaring it as a leading-underscore field (`_fallback: bool = False`)
    silently makes it a Pydantic private attribute instead of a model field, so
    the key never reaches the client and the branch is dead. It must be an
    aliased field, and it must be present in the serialized payload.
    """
    canned = ExecuteDirectiveResponse(thought_process="t", assistant_message="m", fallback=True)
    real = ExecuteDirectiveResponse(thought_process="t", assistant_message="m", fallback=False)

    assert canned.model_dump(by_alias=True)["_fallback"] is True
    assert real.model_dump(by_alias=True)["_fallback"] is False
