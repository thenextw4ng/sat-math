# SAT Math — Interactive Local Practice

A browser-based SAT Math practice app built around the user's licensed local question-bank PDF. The original PDF is selected in the browser and rendered locally; question pages are not copied into the repository.

## Run locally

1. Install the PDF manifest dependency:

   ```bash
   python3 -m pip install -r requirements.txt
   ```

2. Generate the metadata-only manifest from the source PDF:

   ```bash
   python3 scripts/build_bank.py "/path/to/questionbank-export-2026-11-19.pdf"
   ```

3. Start the local web server from the repository root:

   ```bash
   python3 -m http.server 8000
   ```

4. Open `http://localhost:8000` and select the same PDF using **Load question PDF**.

The app uses PDF.js from a CDN to render the chosen page in the browser. An internet connection is required for PDF.js and fonts. The PDF itself is not uploaded by this app.

## Source-bank audit

The supplied export contains 642 pages and 610 unique Question IDs: 387 multiple-choice questions and 223 grid-in questions. All 610 are tagged Hard in the export. Domain counts: Algebra 147, Advanced Math 198, Problem-Solving and Data Analysis 113, Geometry and Trigonometry 152.

## Features

- Interactive A–D selection and numeric grid-in answer entry.
- Automatic checking, fraction/decimal equivalence, browser-local progress, accuracy, bookmarks, domain/skill filters, random questions and navigation.
- Question rendering clipped before the source answer/rationale section.
- Curated Indonesian explanations and Desmos-only guides for the first six Question IDs.
- For other IDs, the app copies a source-specific prompt containing the exact Question ID and PDF page to prepare the Indonesian rationale paraphrase and Desmos walkthrough.

## Project files

- `index.html`, `app.js`, `styles.css` — web app
- `scripts/build_bank.py` — creates a metadata-only manifest from the local PDF
- `data/questions.json` — generated locally and ignored by Git
- `data/desmos-solutions.json` — curated guides keyed by Question ID

The manifest contains IDs, page numbers, domain/skill metadata, crop boundaries and answer keys. It does not contain the wording of questions or page images. Do not commit the source PDF or page-image copies to this repository.
