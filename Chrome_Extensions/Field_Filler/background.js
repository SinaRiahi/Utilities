/**
 * Field Filler - Quill Edition (v2.0)
 * Background Service Worker
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Field Filler Quill Engine v2.0 initialized.');
  chrome.storage.local.get(['templates'], (res) => {
    if (!res.templates) {
      chrome.storage.local.set({ templates: {} });
    }
  });
});
