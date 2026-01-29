// content.js - Content script for Blackboard Quiz to PDF
// Most logic is injected via popup.js using chrome.scripting.executeScript
// This file can be used for persistent page modifications if needed

console.log('Blackboard Quiz to PDF extension loaded');

// Add a subtle indicator that the extension is active on quiz pages
(function () {
    const indicators = [
        '.vtbegenerated',
        '[class*="question"]',
        '.assessmentBody',
        '#assessment_main'
    ];

    const hasQuizContent = indicators.some(sel => document.querySelector(sel));

    if (hasQuizContent) {
        console.log('Blackboard Quiz to PDF: Quiz content detected on this page');
    }
})();