# SAT Math — Interactive Local Practice

A browser-based SAT Math practice app built around the user's licensed local question-bank PDF.

## Run

1. Download and extract the complete local app bundle provided in this conversation into this repository folder.
2. Run `python3 -m http.server 8000` from the project root.
3. Open `http://localhost:8000` and choose the original PDF using **Load question PDF**.

The browser renders the selected PDF locally. The app does not upload the PDF or store cropped page copies.

## Source-bank audit

The supplied export contains 642 pages and 610 unique Question IDs: 387 multiple-choice questions and 223 grid-in questions. All are tagged Hard in the export. Domain counts: Algebra 147, Advanced Math 198, Problem-Solving and Data Analysis 113, Geometry and Trigonometry 152.

## Project structure

- `index.html`, `app.js`, `styles.css` — local web application
- `scripts/build_bank.py` — generate a metadata-only manifest from the local PDF
- `data/questions.json` — generated question IDs, page locations, metadata, answer keys and crop boundaries
- `data/desmos-solutions.json` — Indonesian explanations and Desmos-only walkthroughs keyed by Question ID

The original question pages remain in the user's selected local PDF. Do not commit the source PDF or copied question images to this repository.
