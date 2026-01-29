// popup.js - Handles UI interactions and communicates with content script

document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('status');
    const convertBtn = document.getElementById('convertBtn');
    const previewBtn = document.getElementById('previewBtn');

    // Check if we're on a Blackboard page
    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });
    const url = tab?.url || '';

    const isBlackboardPage = url.includes('blackboard') ||
        url.includes('learn.syr') ||
        url.includes('syracuse.edu');

    if (!isBlackboardPage) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Please navigate to a Blackboard quiz page first.';
        convertBtn.disabled = true;
        previewBtn.disabled = true;
        return;
    }

    // Check if quiz content is detected
    try {
        const results = await chrome.scripting.executeScript({
            target: {
                tabId: tab.id
            },
            func: detectQuizContent
        });

        const detection = results[0]?.result;

        if (detection?.found) {
            statusEl.className = 'status success';
            let msg = `Found ${detection.questionCount} question(s)`;
            if (detection.blankCount > 0) {
                msg += ` with ${detection.blankCount} fill-in blanks`;
            }
            if (detection.isUltra) {
                msg += ' (Ultra)';
            }
            statusEl.textContent = msg;
        } else {
            statusEl.className = 'status info';
            statusEl.textContent = 'No quiz detected. Try opening a quiz results or review page.';
        }
    } catch (err) {
        statusEl.className = 'status error';
        statusEl.textContent = 'Could not access page. Try refreshing.';
        console.error(err);
    }

    // Get options
    function getOptions() {
        return {
            includeAnswers: document.getElementById('includeAnswers').checked,
            includeFeedback: document.getElementById('includeFeedback').checked,
            includePoints: document.getElementById('includePoints').checked,
            compactMode: document.getElementById('compactMode').checked,
            onePerPage: document.getElementById('onePerPage').checked
        };
    }

    // Convert button handler
    convertBtn.addEventListener('click', async () => {
        convertBtn.disabled = true;
        convertBtn.textContent = 'Processing...';

        try {
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                func: extractAndConvert,
                args: [getOptions(), false]
            });

            statusEl.className = 'status success';
            statusEl.textContent = 'Print dialog opened! Select "Save as PDF".';
        } catch (err) {
            statusEl.className = 'status error';
            statusEl.textContent = 'Error: ' + err.message;
        } finally {
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert to PDF';
        }
    });

    // Preview button handler
    previewBtn.addEventListener('click', async () => {
        previewBtn.disabled = true;
        previewBtn.textContent = 'Loading...';

        try {
            await chrome.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                func: extractAndConvert,
                args: [getOptions(), true]
            });

            statusEl.className = 'status success';
            statusEl.textContent = 'Preview opened in new tab.';
        } catch (err) {
            statusEl.className = 'status error';
            statusEl.textContent = 'Error: ' + err.message;
        } finally {
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview First';
        }
    });
});

// Function injected into page to detect quiz content
function detectQuizContent() {

    // Blackboard Ultra selectors (Syracuse)
    const ultraSelectors = [
        '.assessment-question',
        'li[ng-repeat*="questionAttempt"]',
        '.ql-editor.bb-editor',
        'span[data-blankid]',
        '[class*="js-question-type"]'
    ];

    // Classic Blackboard selectors
    const classicSelectors = [
        '.vtbegenerated',
        '[class*="question"]',
        '.assessmentBody',
        '#assessment_main',
        '.questionBlock'
    ];

    let found = false;
    let questionCount = 0;

    // Check Ultra first
    for (const selector of ultraSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            found = true;
            break;
        }
    }

    // Then check Classic
    if (!found) {
        for (const selector of classicSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                found = true;
                break;
            }
        }
    }

    // Count questions - use ONE selector, not multiple that could overlap
    // Prefer .assessment-question as it's the direct question container
    let ultraQuestions = document.querySelectorAll('.assessment-question');
    if (ultraQuestions.length === 0) {
        // Fallback to li elements
        ultraQuestions = document.querySelectorAll('li[ng-repeat*="questionAttempt"]');
    }

    if (ultraQuestions.length > 0) {
        questionCount = ultraQuestions.length;
    } else {
        // Classic style
        const classicQuestions = document.querySelectorAll('.questionBlock, [id^="question-"]');
        questionCount = classicQuestions.length;
    }

    // Also count by blank fields as a sanity check
    const blankCount = document.querySelectorAll('span[data-blankid]').length;

    return {
        found,
        questionCount: questionCount || '?',
        blankCount: blankCount,
        isUltra: document.querySelector('.ql-editor.bb-editor') !== null
    };
}

// Main extraction and conversion function (injected into page)
function extractAndConvert(options, previewOnly) {
    // Quiz extraction logic - optimized for Blackboard Ultra (Syracuse)

    const BLANK_PLACEHOLDER = '               '; // '_______________';

    function extractQuizData() {
        const quiz = {
            title: '',
            course: '',
            date: new Date().toLocaleDateString(),
            score: '',
            questions: []
        };

        // Extract title
        quiz.title = document.querySelector(
            'title, #pageTitleText, .page-title, h1'
        )?.textContent?.trim()?.replace('View Assessment', '').trim() || 'Blackboard Quiz';

        if (quiz.title === '' || quiz.title === 'Blackboard Quiz') {
            // Try to get from breadcrumb or header
            const headerEl = document.querySelector('[class*="panel-title secondary-title student"], .content-title');
            if (headerEl) quiz.title = headerEl.getAttribute('title');
        }

        // Extract course name
        quiz.course = document.querySelector(
            '#courseMenu_link, .course-title, [class*="course-name"], .courseName'
        )?.textContent?.trim() || '';

        if (quiz.course === '') {
            const headerEl = document.querySelector(
                '[class*="course bb-offcanvas-container color-selection-live-mode route-view-container course-color-4 bb-offcanvas-open over-right"]'
                );
            if (headerEl) quiz.course = headerEl.getAttribute('aria-label').substring(7);
        }

        // Extract score if visible
        // const scoreEl = document.querySelector(
        //   '.grade, [class*="score"], [class*="grade"], .attemptScore'
        // );
        // if (scoreEl) {
        //   quiz.score = scoreEl.textContent.trim();
        // }

        // Find all questions using Ultra-specific selectors
        const questionContainers = findQuestionContainers();

        questionContainers.forEach((container, index) => {
            const question = extractQuestion(container, index + 1);
            if (question) {
                quiz.questions.push(question);
            }
        });

        return quiz;
    }

    function findQuestionContainers() {
        // Primary: Blackboard Ultra assessment questions
        let containers = document.querySelectorAll('.assessment-question');
        if (containers.length > 0) return Array.from(containers);

        // Alternative: li elements with questionAttempt
        containers = document.querySelectorAll('li[ng-repeat*="questionAttempt"]');
        if (containers.length > 0) return Array.from(containers);

        // Fallback: any element with assessment-question class pattern
        containers = document.querySelectorAll('[class*="assessment-question"], [class*="questionBlock"]');
        if (containers.length > 0) return Array.from(containers);

        // Classic Blackboard fallback
        containers = document.querySelectorAll('.questionBlock, [id^="question"]');
        if (containers.length > 0) return Array.from(containers);

        return [];
    }

    function extractQuestion(container, number) {
        const question = {
            number: number,
            text: '',
            type: 'fill-in-blank',
            points: '',
            images: [],
            feedback: '',
            isCorrect: null
        };

        // Extract question number from header if available
        const questionLabel = container.querySelector('.question-label, h3.question-label');
        if (questionLabel) {
            const match = questionLabel.textContent.match(/Question\s+(\d+)/i);
            if (match) question.number = parseInt(match[1]);
        }

        // Extract points
        const pointsEl = container.querySelector('.point-value, [class*="points"]');
        if (pointsEl) {
            question.points = pointsEl.textContent.trim();
        }

        // Extract question content from the Quill editor
        const editorEl = container.querySelector('.ql-editor.bb-editor, .bb-editor, [class*="question-text"]');
        if (editorEl) {
            // Clone the element to manipulate without affecting the page
            const clone = editorEl.cloneNode(true);

            // Replace all blank input spans with underscores
            clone.querySelectorAll('span[data-blankid]').forEach(blank => {
                const placeholder = document.createElement('span');
                placeholder.className = 'answer-blank';
                placeholder.textContent = ' ' + BLANK_PLACEHOLDER + ' ';
                blank.replaceWith(placeholder);
            });

            // Extract and process images
            clone.querySelectorAll('div[data-bbtype="editAttachment"], div[data-bbtype="attachment"]').forEach(
                imgContainer => {
                    const href = imgContainer.getAttribute('href');
                    const bbfile = imgContainer.getAttribute('data-bbfile');

                    let imgName = 'Figure';
                    if (bbfile) {
                        try {
                            const fileData = JSON.parse(bbfile);
                            imgName = fileData.linkName || 'Figure';
                        } catch (e) {}
                    }

                    if (href) {
                        question.images.push({
                            src: href,
                            name: imgName
                        });

                        // Replace with a cleaner image reference
                        const imgPlaceholder = document.createElement('div');
                        imgPlaceholder.className = 'image-placeholder';
                        imgPlaceholder.setAttribute('data-src', href);
                        imgPlaceholder.setAttribute('data-name', imgName);
                        imgContainer.replaceWith(imgPlaceholder);
                    }
                });

            // Also check for regular img tags
            clone.querySelectorAll('img').forEach(img => {
                const src = img.src;
                if (src && !question.images.find(i => i.src === src)) {
                    question.images.push({
                        src: src,
                        name: img.alt || 'Figure'
                    });
                }
            });

            // Get the cleaned HTML
            question.text = clone.innerHTML;

            // Clean up excessive whitespace and empty elements
            question.text = question.text
                .replace(/<div[^>]*class="[^"]*ally[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '') // Remove ally widgets
                .replace(/<div[^>]*class="[^"]*MuiFormControl[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
                '') // Remove MUI form controls
                .replace(/<span[^>]*class="[^"]*score-indicator[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
                '') // Remove score indicators
                .replace(/\s+/g, ' ')
                .trim();
        }

        // Extract feedback if present
        const feedbackEl = container.querySelector(
            '.feedbackText, [class*="feedback"], .instructorFeedback'
        );
        if (feedbackEl) {
            question.feedback = feedbackEl.innerHTML;
        }

        // Check for correct/incorrect status
        const correctIndicator = container.querySelector('.correct, [class*="correct"], .success');
        const incorrectIndicator = container.querySelector('.incorrect, [class*="incorrect"], .error');

        if (correctIndicator) question.isCorrect = true;
        else if (incorrectIndicator) question.isCorrect = false;

        return question;
    }

    function generatePrintHTML(quiz, options) {
        const compact = options.compactMode;
        const onePerPage = options.onePerPage;

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(quiz.title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      max-width: 8in;
      margin: 0 auto;
      padding: ${compact ? '0.5in' : '0.75in'};
      color: #000;
      background: #fff;
    }
    
    @media print {
      body {
        padding: 0;
      }
    }
    
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: ${compact ? '8px' : '12px'};
      margin-bottom: ${compact ? '16px' : '24px'};
    }
    
    .header h1 {
      font-size: 18pt;
      margin: 0 0 4px 0;
    }
    
    .header .meta {
      font-size: 10pt;
      color: #444;
    }
    
    .question {
      margin-bottom: ${compact ? '20px' : '28px'};
      ${onePerPage ? '' : 'page-break-inside: avoid;'}
    }
    
    ${onePerPage ? `.question { page-break-after: always; }
    .question:last-child { page-break-after: auto; }` : ''}
    
    .question-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #ccc;
    }
    
    .question-number {
      font-weight: bold;
      font-size: 12pt;
    }
    
    .question-points {
      font-size: 10pt;
      color: #666;
    }
    
    .question-status {
      font-size: 9pt;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: auto;
    }
    
    .question-status.correct {
      background: #d4edda;
      color: #155724;
    }
    
    .question-status.incorrect {
      background: #f8d7da;
      color: #721c24;
    }
    
    .question-text {
      margin-bottom: 12px;
    }
    
    .question-text p {
      margin: 0.4em 0;
    }
    
    .answer-blank {
      display: inline-block;
      border-bottom: 1px solid #000;
      min-width: 100px;
      text-align: center;
      font-family: monospace;
      padding: 0 4px;
    }
    
    .question-images {
      margin: 16px 0;
      text-align: center;
    }
    
    .question-images img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 8px 0;
    }
    
    .feedback {
      margin-top: 12px;
      padding: 8px 12px;
      background: #f8f9fa;
      border-left: 3px solid #6c757d;
      font-size: 10pt;
    }
    
    .feedback-label {
      font-weight: bold;
      font-size: 9pt;
      color: #666;
      margin-bottom: 4px;
    }
    
    @media print {
      .question {
        ${onePerPage ? 'page-break-after: always;' : 'break-inside: avoid;'}
      }
      ${onePerPage ? '.question:last-child { page-break-after: auto; }' : ''}
      .no-print {
        display: none;
      }
    }
    
    .no-print {
      background: linear-gradient(135deg, #ff8800 0%, #f7b603 100%);
      padding: 20px 24px;
      margin-bottom: 24px;
      border-radius: 12px;
      border-color: #0400ff;
      border-style: solid;
      border-width: 5px;
      text-align: center;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }
    
    .no-print h2 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
    }
    
    .no-print p {
      margin: 0 0 16px 0;
      font-size: 14px;
      opacity: 0.9;
    }
    
    .no-print .controls {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 16px;
    }
    
    .no-print label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 14px;
      background: rgba(255,255,255,0.15);
      padding: 8px 14px;
      border-radius: 8px;
      transition: background 0.2s;
    }
    
    .no-print label:hover {
      background: rgba(255,255,255,0.25);
    }
    
    .no-print input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #fff;
    }
    
    .no-print button {
      background: #fff;
      color: #667eea;
      border: none;
      padding: 12px 28px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .no-print button:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .no-print button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h2>📄 Preview Mode</h2>
    <p>Review your quiz below, then print or save as PDF. (Disable headers & footers!)</p>
    <div class="controls">
      <label>
        <input type="checkbox" id="editMode"> Enable editing
      </label>
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
  
  <div class="header">
    <h1>${escapeHtml(quiz.title) || 'Blackboard Quiz'}</h1>
    <div class="meta">
      ${quiz.course ? `<div><strong>Course:</strong> ${escapeHtml(quiz.course)}</div>` : ''}
      <div><strong>Exported:</strong> ${quiz.date}</div>
      <div><strong>Questions: </strong>${quiz.questions.length}</div>
    </div>
  </div>
  
  <div class="questions">
    ${quiz.questions.map((q, i) => generateQuestionHTML(q, options)).join('')}
  </div>
</body>
</html>`;
    }

    function generateQuestionHTML(q, options) {
        let statusHTML = '';
        if (q.isCorrect === true) {
            statusHTML = '<span class="question-status correct">Correct</span>';
        } else if (q.isCorrect === false) {
            statusHTML = '<span class="question-status incorrect">Incorrect</span>';
        }

        // Process question text - convert image placeholders to actual images
        let processedText = q.text;

        // Remove any remaining complex nested elements
        processedText = processedText
            .replace(/<div[^>]*class="[^"]*bb-editor-file-viewer[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
            .replace(/<div[^>]*class="[^"]*makeStyles[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

        // Build images HTML
        let imagesHTML = '';
        if (q.images.length > 0) {
            imagesHTML = '<div class="question-images">' +
                q.images.map(img =>
                    `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.name)}">`
                ).join('') +
                '</div>';
        }

        let feedbackHTML = '';
        if (options.includeFeedback && q.feedback) {
            feedbackHTML = `<div class="feedback">
        <div class="feedback-label">Feedback:</div>
        ${q.feedback}
      </div>`;
        }

        return `
    <div class="question">
      <div class="question-header">
        <span class="question-number">Question ${q.number}</span>
        ${options.includePoints && q.points ? `<span class="question-points">${q.points}</span>` : ''}
        ${statusHTML}
      </div>
      <div class="question-text">${processedText}</div>
      ${imagesHTML}
      ${feedbackHTML}
    </div>`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Main execution
    const quizData = extractQuizData();
    const html = generatePrintHTML(quizData, options);

    // Open in new window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();

    // Attach edit mode listener directly (avoids CSP issues entirely)
    const editCheckbox = printWindow.document.getElementById('editMode');
    if (editCheckbox) {
        editCheckbox.addEventListener('change', function () {
            if (this.checked) {
                printWindow.document.body.contentEditable = 'true';
                printWindow.document.designMode = 'on';
            } else {
                printWindow.document.body.contentEditable = 'false';
                printWindow.document.designMode = 'off';
            }
        });
    }

    // Auto-trigger print dialog if not preview only
    if (!previewOnly) {
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };
    }
}