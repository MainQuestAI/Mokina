"""Recompute the preserved model outputs; never uses their recorded totals."""
import csv
import hashlib
import io
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "output/playwright/mokina-v003-repair-2026-10-07"
sha = lambda data: hashlib.sha256(data).hexdigest()
files = ["budget-brief.md", "local10-closeout-evidence.json",
         "local7-run-evidence.json", "native-downstream-local7.html"]
source_hashes = {name: sha((SOURCE / name).read_bytes()) for name in files}
evidence = json.loads((SOURCE / files[1]).read_text())
budgets = []
for case in evidence["business"]["budgets"]:
    rows = []
    for line in case["reply"].splitlines():
        cells = [c.strip().replace("**", "") for c in line.split("|")[1:-1]]
        if len(cells) < 3 or cells[0] == "合计":
            continue
        if re.fullmatch(r"[\d,]+", cells[1]) and re.fullmatch(r"\d+%", cells[2]):
            rows.append({"category": cells[0], "amount": int(cells[1].replace(",", "")),
                         "percent": int(cells[2][:-1])})
    assert len(rows) == 10
    assert sum(r["amount"] for r in rows) == case["budget"]
    assert sum(r["percent"] for r in rows) == 100
    assert all(r["amount"] * 100 == case["budget"] * r["percent"] for r in rows)
    assert all(r["amount"] == 0 for r in rows[6:])
    if case["label"] == "B":
        assert rows[0]["amount"] == 0
    budgets.append({"label": case["label"], "runId": case["runId"],
                    "snapshotId": case["snapshotId"], "rowsFromRawReply": rows,
                    "amountSum": sum(r["amount"] for r in rows), "checks": "PASS"})
case = evidence["business"]["csv"]
rows = list(csv.DictReader(io.StringIO(case["text"])))
totals = {}
for row in rows:
    totals[row["month"]] = totals.get(row["month"], 0) + int(row["sales"])
months = sorted(totals)
growth = {months[i]: round((totals[months[i]] / totals[months[i - 1]] - 1) * 100, 2)
          for i in range(1, len(months))}
shares = {r["month"]: round(int(r["sales"]) / totals[r["month"]] * 100, 2)
          for r in rows if r["channel"] == "Tmall" and r["month"] in [months[0], months[-1]]}
reply = case["reply"]
assert all(f"{v:,}" in reply for v in [*totals.values(), sum(totals.values())])
assert all(f"{v:.2f}%" in reply for v in [*growth.values(), *shares.values()])
assert sha(case["text"].encode()) == case["textDigest"]
landing = json.loads((SOURCE / files[2]).read_text())
run = next(r for r in landing["runs"] if r["id"] == "e88e5ca1-ab42-4cd0-8678-ff1503da549d")
assert run["status"] == "succeeded" and run["artifactCount"] == 1
result = {
    "scope": "Historical real model outputs with synthetic business inputs; AI review, not human signoff",
    "sourceHashes": source_hashes,
    "budgetSourceSha": evidence["productSourceSha"], "budgetCandidate": evidence["candidate"],
    "budgets": budgets,
    "csv": {"runId": case["runId"], "frozenTextSha256": sha(case["text"].encode()),
            "originalFileReverified": False, "rowCount": len(rows), "monthlyTotals": totals,
            "total": sum(totals.values()), "growthPercent": growth, "tmallSharePercent": shares,
            "allResultsPresentInRawReply": True},
    "landing": {"sourceSha": landing["sourceSha"], "version": landing["version"],
                "runId": run["id"], "projectId": run["projectId"],
                "conversationId": run["conversationId"], "artifactCount": run["artifactCount"]},
}
print(json.dumps(result, ensure_ascii=False, indent=2))
