// content.js - Content script for Blackboard Print
// Most logic is injected via popup.js using chrome.scripting.executeScript

console.log('Blackboard Print extension loaded!');

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
        console.log('Blackboard Print: Quiz content detected on this page');
    }
})();