// Content script for Canvas pages
// This will be used in Phase 2 and 3 for enhanced Canvas integration

console.log('Canvas Calendar Sync content script loaded');

// Phase 1: Basic content script setup
// This script runs on Canvas pages and can interact with the page content

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'getPageInfo') {
    // Get information about the current Canvas page
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      isCanvasPage: window.location.hostname.includes('instructure.com')
    };
    
    sendResponse(pageInfo);
  }
  
  // Add more message handlers for Phase 2 and 3
  return true; // Indicates async response
});

// Phase 1: Basic page detection
function detectCanvasPage() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  if (hostname.includes('instructure.com')) {
    console.log('Canvas page detected:', pathname);
    
    // Send page info to background script
    chrome.runtime.sendMessage({
      action: 'canvasPageDetected',
      url: window.location.href,
      pathname: pathname
    });
  }
}

// Run detection when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectCanvasPage);
} else {
  detectCanvasPage();
}

// Phase 1: Monitor for navigation changes (single-page app)
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href;
    detectCanvasPage();
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Phase 1: Add visual indicator when extension is active (optional)
function addExtensionIndicator() {
  // Only add if not already present
  if (document.getElementById('canvas-sync-indicator')) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'canvas-sync-indicator';
  indicator.innerHTML = '📅 Canvas Calendar Sync Active';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #1a73e8;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: Arial, sans-serif;
  `;
  
  document.body.appendChild(indicator);
  
  // Remove after 3 seconds
  setTimeout(() => {
    indicator.remove();
  }, 3000);
}

// Show indicator when extension is loaded
addExtensionIndicator();