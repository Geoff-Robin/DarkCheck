document.addEventListener('DOMContentLoaded', function() {
  // Get statistics from storage
  chrome.storage.local.get(['patternCount', 'confidenceAvg'], function(result) {
      document.getElementById('patternCount').textContent = result.patternCount || 0;
      document.getElementById('confidenceAvg').textContent = 
          result.confidenceAvg ? `${(result.confidenceAvg * 100).toFixed(1)}%` : '0%';
  });

  // Scan button click handler
  document.getElementById('scanButton').addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          // First, inject the content script
          chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['content.js']
          }).then(() => {
              // Then send the message
              chrome.tabs.sendMessage(tabs[0].id, {action: 'SCAN_PAGE'}, function(response) {
                  if (chrome.runtime.lastError) {
                      console.log('Error:', chrome.runtime.lastError.message);
                      return;
                  }
                  console.log(response);
              });
          }).catch(err => {
              console.error('Failed to inject content script:', err);
          });
      });
  });
});