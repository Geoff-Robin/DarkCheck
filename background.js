// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
      // Reset counters when page loads
      chrome.storage.local.set({
          patternCount: 0,
          confidenceSum: 0,
          confidenceAvg: 0
      });
  }
});

// Existing message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DARK_PATTERN_DETECTED') {
      // Update storage with new statistics
      chrome.storage.local.get(['patternCount', 'confidenceSum', 'confidenceAvg'], function(result) {
          const currentCount = (result.patternCount || 0) + 1;
          const currentSum = (result.confidenceSum || 0) + message.data.confidence;
          const newAvg = currentSum / currentCount;

          chrome.storage.local.set({
              patternCount: currentCount,
              confidenceSum: currentSum,
              confidenceAvg: newAvg
          });
      });

      console.log('Dark pattern detected:', message.data);
  }
});