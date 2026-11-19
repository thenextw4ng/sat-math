#!/usr/bin/env python3
"""Create a metadata-only manifest from the user's local SAT Math PDF.
Question text and page images remain inside the original local PDF."""
from __future__ import annotations
import argparse
import json
import re
from collections import Counter
from pathlib import Path
import fitz

# The source export omits a standalone Correct Answer line on these pages.
# Values were checked against the rationale on the corresponding source page.
ANSWER_OVERRIDES = {
    "d1b66ae6":["3/2","1.5"], "ee2f611f":["28"], "fdee0fbf":["74"],
    "c362c210":["1.5","3/2"], "d7bf55e1":["180"], "e8f9e117":["20"],
    "466b87e3":["1/2","0.5"], "0366d965":["30"], "cb58833c":["1.25","5/4"],
    "a1fd2304":["1.5","3/2"], "40c09d66":["7/6","1.166","1.167"],
    "f2f3fa00":["5"], "97e50fa2":["2","8"], "58dcc59f":["13"],
    "1697ffcf":["5"], "911c415b":["6632"], "9f2ecade":["210"],
    "43926bd9":["8"], "65c49824":["8"], "0231050d":["75"],
    "d4413871":["8"], "3638f413":["30"], "585de39a":["42"],
    "d0430601":["285"], "54d93874":["2.6"], "94237701":["1"],
    "f88f27e5":["97"], "947a3cde":["30"], "bd87bc09":["24"],
    "ab176ad6":["11"], "55bb437a":["6"], "eeb4143c":["10/3","15/4","25/6"],
    "6933b3d9":["0"], "fb58c0db":["1/6","0.1666","0.1667","0.166","0.167"],
    "f7e626b2":["D"], "dba6a25a":["30"], "6a3fbec3":["4.5","9/2"],
    "25da87f8":["12"]
}
NUM_RE = re.compile(r"(?<![A-Za-z])[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*/\s*\d+)?")

def cell_text(words, x0, x1):
    selected = [w for w in words if x0 <= w[0] < x1 and 75 <= w[1] < 118]
    selected.sort(key=lambda w: (round(w[1] / 3), w[0]))
    return " ".join(w[4] for w in selected).strip()

def crop_bottom(page):
    rects = page.search_for("Correct Answer:")
    if not rects:
        rects = page.search_for("Rationale")
    if not rects:
        raise ValueError("Question page has no answer/rationale boundary")
    return max(100.0, min(r.y0 for r in rects) - 7.0)

def answer_data(text, qid):
    explicit = re.search(r"(?im)^\s*Correct Answer:\s*([^\r\n]+)", text)
    if explicit:
        raw = explicit.group(1).strip()
        if re.fullmatch(r"[A-D]", raw):
            return {"answer":raw, "acceptedAnswers":[raw]}
        values = [re.sub(r"\s+", "", v) for v in NUM_RE.findall(raw)]
        if values:
            return {"answer":values[0], "acceptedAnswers":values}
    if qid in ANSWER_OVERRIDES:
        values = ANSWER_OVERRIDES[qid]
        return {"answer":values[0], "acceptedAnswers":values}
    choice = re.search(r"(?i)Choice\s+([A-D])\s+is correct", text)
    if choice:
        return {"answer":choice.group(1).upper(), "acceptedAnswers":[choice.group(1).upper()]}
    match = re.search(r"(?i)The correct answer is\s+(.{1,100}?)(?:\.|\n)", text)
    if match:
        values = [re.sub(r"\s+", "", v) for v in NUM_RE.findall(match.group(1))]
        if values:
            return {"answer":values[0], "acceptedAnswers":values}
    raise ValueError("Answer key not found for Question ID " + qid)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", help="Path to the SAT Math question-bank PDF")
    parser.add_argument("--output", default="data/questions.json")
    args = parser.parse_args()
    pdf_path = Path(args.pdf).expanduser().resolve()
    if not pdf_path.exists():
        raise SystemExit("PDF not found: " + str(pdf_path))
    doc = fitz.open(pdf_path)
    questions, seen = [], set()
    for page_index, page in enumerate(doc):
        if page_index % 100 == 0:
            print("Processing page " + str(page_index + 1) + "/" + str(len(doc)), flush=True)
        text = page.get_text()
        match = re.search(r"Question ID:\s*([A-Za-z0-9]+)", text)
        if not match:
            continue
        qid = match.group(1).lower()
        if qid in seen:
            raise SystemExit("Duplicate Question ID: " + qid)
        seen.add(qid)
        words = page.get_text("words")
        domain = cell_text(words, 245, 365)
        skill = cell_text(words, 365, 480)
        difficulty = cell_text(words, 480, 620) or "Unknown"
        markers = [p for p in (text.find("Correct Answer:"), text.find("Rationale")) if p >= 0]
        question_text = text[:min(markers)] if markers else text
        labels = set(re.findall(r"(?m)^\s*([A-D])\.\s*", question_text))
        qtype = "mcq" if len(labels) >= 3 else "spr"
        answer = answer_data(text, qid)
        questions.append({
            "id":qid, "number":len(questions)+1, "page":page_index+1,
            "cropBottom":round(crop_bottom(page),2), "domain":domain,
            "skill":skill, "difficulty":difficulty, "type":qtype,
            "answer":answer["answer"], "acceptedAnswers":answer["acceptedAnswers"]
        })
    if not questions:
        raise SystemExit("No Question IDs found in the PDF.")
    result = {
        "pdfPages":len(doc), "questionCount":len(questions),
        "types":dict(Counter(q["type"] for q in questions)),
        "domains":dict(Counter(q["domain"] for q in questions)),
        "difficulties":dict(Counter(q["difficulty"] for q in questions)),
        "sourceName":pdf_path.name, "schemaVersion":1, "questions":questions
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k != "questions"}, ensure_ascii=False, indent=2))
    print("Manifest saved to: " + str(output.resolve()))

if __name__ == "__main__":
    main()
