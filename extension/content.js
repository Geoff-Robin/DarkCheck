let isScanning = false;
let scannedElements = new Set();

function extractTextContent() {
    const allElements = document.querySelectorAll('div, section, article');
    const targetElements = Array.from(allElements).filter(element => {
        // Check if element has 4 or more children
        return element.children.length >= 6 &&
               // Still check for common dark pattern containers
               (element.matches('[class*="popup"], [class*="modal"], [class*="banner"], [class*="offer"]') ||
                element.querySelector('button, a, div[role="button"]'));
    });
    
    return targetElements.map(element => ({
        text: Array.from(element.children)
                   .map(child => child.innerText.trim())
                   .join(' '),
        element: element
    })).filter(item => item.text.length > 0);
}

// Function to analyze text for dark patterns
async function analyzeDarkPatterns(text) {
    try {
        // Add logging for request
        console.log('Sending request for text:', text);
        
        const response = await fetch('http://127.0.0.1:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                text: text,
                url: window.location.href // Add context
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }
        
        const result = await response.json();
        
        // Validate response format
        if (!result || typeof result.probability === 'undefined') {
            throw new Error('Invalid response format from server');
        }
        
        return {
            probability: result.probability,
            isDarkPattern: result.is_dark_pattern,
            confidence: result.confidence
        };
    } catch (error) {
        console.error('Error analyzing text:', error);
        console.error('Failed text:', text);
        return null;
    }
}

// Function to highlight dark patterns
function highlightDarkPattern(element, confidence) {
    // Check if element is already highlighted
    if (element.classList.contains('dark-pattern-detected')) {
        return;
    }

    // Mark element as highlighted
    element.classList.add('dark-pattern-detected');

    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'dark-pattern-wrapper';
    wrapper.style.cssText = `
        position: relative;
        display: inline-block;
        margin-top: 20px;
    `;

    // Create badge
    const badge = document.createElement('div');
    badge.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background-color: rgba(255, 0, 0, 0.8);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
        z-index: 2147483647;
    `;
    badge.textContent = `Dark Pattern (${(confidence * 100).toFixed(1)}%)`;

    // Add highlight effect
    element.style.cssText += `
        box-shadow: 0 0 0 2px rgba(255, 0, 0, 0.5);
        border-radius: 2px;
    `;

    // Insert wrapper and badge
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
    wrapper.appendChild(badge);
}

// Main function to detect and highlight dark patterns
async function detectDarkPatterns() {
    if (isScanning) {
        console.log('Scan already in progress, skipping...');
        return;
    }
    
    isScanning = true;
    const textElements = extractTextContent();
    
    for (const { text, element } of textElements) {
        // Skip if element was already scanned
        if (scannedElements.has(element)) {
            continue;
        }
        
        const analysis = await analyzeDarkPatterns(text);
        
        if (analysis && analysis.isDarkPattern) {
            highlightDarkPattern(element, analysis.confidence);
            scannedElements.add(element);
            
            chrome.runtime.sendMessage({
                type: 'DARK_PATTERN_DETECTED',
                data: {
                    text: text,
                    url: window.location.href,
                    confidence: analysis.confidence,
                    isDarkPattern: analysis.isDarkPattern
                }
            });
        }
    }
    isScanning = false;
}

// Run detection when page loads
detectDarkPatterns();

// Observer for dynamic content changes
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            detectDarkPatterns();
            break;
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCAN_PAGE') {
        detectDarkPatterns();
        sendResponse({ status: 'Scanning completed' });
    }
    return true;
});