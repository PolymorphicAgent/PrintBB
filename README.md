# <img src="public/icons/favicon.ico" width="45" align="left">Blackboard Print

A Chrome extension that converts SU Blackboard quizzes into clean, printer-friendly PDF files.

## Installation for normal users

Can be installed from the Chrome Web Store: (link will be inserted here once the extension is uploaded)

## Installation for Developers

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `PrintBB` folder you extracted from the latest release into a **safe** location
5. The extension icon should appear in your toolbar

## Usage

1. Navigate to a SU Blackboard quiz page (completed quiz, quiz review, or quiz results)
2. Click the extension icon in your toolbar
3. Check the options you want in the popup
4. Click **Preview First** to see how it looks, or **Convert to PDF** to go straight to print
5. In the print dialog, select **Save as PDF** as your printer/destination to save the quiz as a PDF. (Or, you can just print directly!)

## Supported Blackboard Versions

The extension has only been tested with blackboard Ultra! (Specifically, for Syracuse University)

## Troubleshooting

**"No quiz detected"**
- Make sure you're on a quiz page, and the questions are visible (the extension can see only what you see!)
- Try refreshing the page and clicking the extension again
- Open an issue if the problem persists

**Missing questions or answers**
- Blackboard's HTML structure varies by institution and quiz type
- The extension uses multiple detection strategies but may not catch everything
- Again, if a problem persists, open an issue

## Customization

Press the **Editing Mode** checkbox to directly edit the page before printing!

## Files

```
blackboard-quiz-pdf/
├── manifest.json     # Extension configuration
├── popup.html        # Extension popup UI
├── popup.js          # Main logic
├── content.js        # Content script (detection)
├── content.css       # Page styles (minimal)
├── icons/            # Extension icons
│  └── icon_X.png
└── README.md         # This file
```

## How It Works

1. When you click the extension, it checks if the current page has quiz-like content
2. It then parses the page DOM looking for questions, course name, assignment name, etc.
3. Behind the scenes, it generates a print-optimized HTML document
4. Opens the generated document in a new tab where you can preview, edit, and/or print to PDF

## Please Note:

- DOUBLE CHECK TO MAKE SURE THAT ALL THE QUESTIONS ARE PRESENT! I DO NOT TAKE RESPONSIBILITY IF A BUG CAUSES YOUR PRINTED DOCUMENT TO EXCLUDE CONTENT. USE AT YOUR OWN RISK, UNDERSTANDING THAT THIS EXTENSION WAS CODED IN A LITTLE UNDER A WEEK AND A HALF. YOU HAVE BEEN WARNED.
- Image-based questions may not extract perfectly
- Blackboard's HTML structure is inconsistent and frequently changed, so expect the extension to break from time to time!
- If you find any major problems, feel free to open an issue with a _detailed_ explanation of how to reproduce the problem!


---

This project was bootstrapped with [Chrome Extension CLI](https://github.com/dutiyesh/chrome-extension-cli)
