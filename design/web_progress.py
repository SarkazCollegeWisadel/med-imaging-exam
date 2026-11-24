"""Import user-confirmed website receipts into the local Study Desk ledger."""

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

from study_memory.core import EventConflict, InvalidEvent, Ledger, normalized_event

PREFIX = "STUDY-DESK/1"
MAX_BYTES = 160_000
FIELDS = {"id", "at", "source", "title", "locator", "action"}
HOST = "sarkazcollegewisadel.github.io"
SITES = ("/med-imaging-exam/", "/diagnostics-atlas/", "/xinxiang-ecg-learning/", "/EforGla/")


def parse_receipts(text):
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise InvalidEvent("学习码超过大小限制")
    header, _, payload = text.strip().lstrip("\ufeff").partition("\n")
    if header.strip() != PREFIX:
        raise InvalidEvent("请粘贴以 STUDY-DESK/1 开头的完整学习码")
    try:
        envelope = json.loads(payload)
    except ValueError:
        raise InvalidEvent("学习码的 JSON 结构不完整") from None
    if not isinstance(envelope, dict) or set(envelope) != {"events"}:
        raise InvalidEvent("学习码字段不符合当前版本")
    records = envelope["events"]
    if not isinstance(records, list) or not 1 <= len(records) <= 120:
        raise InvalidEvent("每批学习码需包含 1 至 120 条记录")
    events = []
    seen = {}
    for item in records:
        if not isinstance(item, dict) or set(item) != FIELDS or any(not isinstance(v, str) for v in item.values()):
            raise InvalidEvent("学习记录字段不完整")
        ident = item["id"]
        if not re.fullmatch(r"[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}", ident):
            raise InvalidEvent("学习记录 ID 格式错误")
        try:
            source = urlsplit(item["source"])
            route = unquote(source.path)
            when = datetime.fromisoformat(item["at"].replace("Z", "+00:00"))
        except ValueError:
            raise InvalidEvent("学习记录的来源或时间格式错误") from None
        if (source.scheme != "https" or source.netloc != HOST or not route.startswith(SITES)
                or source.query or source.fragment or ".." in route.split("/")
                or len(item["source"]) > 340):
            raise InvalidEvent("来源需为帮学站的 HTTPS 页面")
        if when.tzinfo is None or when > datetime.now(timezone.utc) + timedelta(minutes=10):
            raise InvalidEvent("设备记录时间不正确")
        if item["action"] not in {"browse", "practice", "review"}:
            raise InvalidEvent("未知的学习方式")
        event = {
            "event_id": "web-study:" + ident,
            "occurred_at": item["at"],
            "actor": "user",
            "action": item["action"],
            "topic": item["locator"],
            "evidence": {"kind": "explicit_user_statement", "ref": "web-study:confirmed:" + ident},
            "source_refs": [{"source_id": "web-study:" + route, "title": item["title"],
                             "locator": item["locator"], "uri": item["source"]}],
        }
        normalized, _ = normalized_event(event)
        if ident in seen and seen[ident] != normalized:
            raise InvalidEvent("学习码内有相同 ID 对应不同记录")
        seen[ident] = normalized
        events.append(event)
    return events


def import_receipts(text, ledger):
    events = parse_receipts(text)
    summary_dates = set()
    result = {"inserted": 0, "duplicates": 0, "conflicts": 0}
    for event in events:
        try:
            receipt = ledger.record(event)
        except EventConflict:
            result["conflicts"] += 1
            continue
        result["inserted" if receipt["inserted"] else "duplicates"] += 1
        summary_dates.add(receipt["date"])
    for day in sorted(summary_dates):
        ledger.distill(day)
    return {**result, "summaries": sorted(summary_dates)}


def read_file(path):
    with Path(path).open("rb") as handle:
        data = handle.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise InvalidEvent("学习码超过大小限制")
    return data.decode("utf-8-sig")


def open_window(ledger):
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    window = tk.Tk()
    window.title("导入网页学习记录")
    window.geometry("700x480")
    window.minsize(460, 320)
    frame = ttk.Frame(window, padding=14)
    frame.pack(fill="both", expand=True)
    ttk.Label(frame, text="粘贴学习码，或打开设备下载的网页学习记录。").pack(anchor="w")
    field = tk.Text(frame, height=14, wrap="word", undo=True)
    field.pack(fill="both", expand=True, pady=8)
    actions = ttk.Frame(frame)
    actions.pack(fill="x")
    status = tk.StringVar(value="导入后会更新本机账本及相关日期的摘要。")
    ttk.Label(frame, textvariable=status, wraplength=415).pack(anchor="w", pady=8)

    def open_file():
        path = filedialog.askopenfilename(filetypes=[("网页学习记录", "*.txt"), ("所有文件", "*.*")])
        if path:
            try:
                text = read_file(path)
            except (OSError, UnicodeError, InvalidEvent) as error:
                messagebox.showerror("打不开学习记录", str(error))
                return
            field.delete("1.0", "end")
            field.insert("1.0", text)

    def run():
        try:
            note = import_receipts(field.get("1.0", "end-1c"), ledger)
        except (InvalidEvent, ValueError) as error:
            messagebox.showerror("学习码无法导入", str(error))
            return
        except Exception:
            status.set("归档遇到存储错误。请保留原学习码，恢复后可重试，已存记录会去重。")
            return
        days = "、".join(note["summaries"])
        status.set(f'新增 {note["inserted"]} 条，重复 {note["duplicates"]} 条，冲突 {note["conflicts"]} 条。摘要日期：{days or "无"}。')

    ttk.Button(actions, text="打开记录文件", command=open_file).pack(side="left")
    ttk.Button(actions, text="确认并归档", command=run).pack(side="right")
    field.focus_set()
    window.mainloop()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", type=Path, help="导入指定的学习记录文本文件")
    parser.add_argument("--data-dir", type=Path, help="覆盖账本目录，例如测试用临时目录")
    args = parser.parse_args()
    ledger = Ledger(args.data_dir)
    if args.file:
        try:
            result = import_receipts(read_file(args.file), ledger)
        except (OSError, InvalidEvent, ValueError) as error:
            print(str(error), file=sys.stderr)
            return 2
        print(json.dumps(result, ensure_ascii=False))
        return 2 if result["conflicts"] else 0
    open_window(ledger)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
