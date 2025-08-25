// Function to check for specific Japanese kana characters
function containsJapanese(text) {
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
    return japaneseRegex.test(text);
}

// Function to check if a string contains specific keywords you want to keep
function containsHololiveKeywords(text) {
    const keywords = ['hololive', 'vtuber', 'gawr gura', 'pekora', 'korone', 'kobo kanaeru', 'ayunda risu', 'kaela', 'sana', 'kronii', 'mumei', 'nanashi', 'shiori', 'milo', 'nerissa', 'fuma', 'fuwamoco'];
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
}

// A Promise-based function for very short delays
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Core function to click "Not interested"
async function clickNotInterested(videoElement) {
    console.log("Attempting to click 'Not interested' for a video.");
    
    // Find the three-dot menu button
    const menuButton = videoElement.querySelector('button[aria-label="More actions"], button[aria-label="Action menu"]');

    if (!menuButton) {
        console.warn("Could not find menu button for a video. Skipping.");
        return;
    }

    // Use a more direct method to trigger the menu
    menuButton.click();

    // Delay for the "Not interested" menu to appear.
    // This delay is intentionally short (200ms) for responsiveness.
    await sleep(200); 

    // Find the "Not interested" button in the menu
    const notInterestedButton = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer, yt-list-item-view-model')).find(item => {
        const textContent = (item.textContent || '').trim();
        return textContent.includes('Don\'t recommend channel') || textContent.includes('Not interested');
    });

    if (notInterestedButton) {
        notInterestedButton.click();
        console.log("Clicked 'Not interested' successfully.");
    } else {
        console.warn("Could not find 'Not interested' button. Closing menu.");
        // Close the menu by clicking the overlay
        const overlay = document.querySelector('tp-yt-iron-overlay-backdrop');
        if (overlay) overlay.click();
    }
}

// Global queue and state variables
const videoQueue = new Set();
let isProcessingQueue = false;
let processTimeout = null;

// Function to process a single video element
async function processVideo(videoElement) {
    // Only process the video if it has not been processed before
    if (videoElement.dataset.processed === 'true') {
        return;
    }

    // Check if it's a Shorts video, which has a different structure
    if (videoElement.closest('ytd-rich-shelf-renderer[is-shorts]')) {
        console.log("Skipping Shorts video.");
        return;
    }
    
    // Improved selectors to find the video title element
    const videoTitleElement = videoElement.querySelector(
        '#video-title, ' +
        'yt-formatted-string.ytd-rich-grid-media, ' +
        '.yt-lockup-metadata-view-model-wiz__title, ' +
        '#video-title-and-metadata h3' 
    );

    if (videoTitleElement) {
        const videoTitle = videoTitleElement.textContent || '';
        console.log(`Processing video with title: "${videoTitle}"`);

        // Only act if the video title does NOT contain Japanese characters OR your keywords
        if (!containsJapanese(videoTitle) && !containsHololiveKeywords(videoTitle)) {
            console.log("Title does not contain Japanese characters or keywords. Disliking.");
            await clickNotInterested(videoElement);
        } else {
            console.log("Title contains Japanese characters or keywords. Skipping.");
        }
    } else {
        if (videoElement.querySelector('ytd-ad-slot-renderer')) {
            console.log("Skipping sponsored content.");
        } else {
            console.warn("Could not find video title for a non-sponsored element. Skipping.");
        }
    }

    // Mark the video as processed
    videoElement.dataset.processed = 'true';
}

// Function to process the video queue
async function processVideoQueue() {
    if (isProcessingQueue) {
        return;
    }

    isProcessingQueue = true;
    const videosToProcess = [...videoQueue];
    videoQueue.clear();

    for (const videoElement of videosToProcess) {
        await processVideo(videoElement);
        // The key change: a longer delay between videos for better reliability.
        await sleep(1000); 
    }

    isProcessingQueue = false;
    console.log("Finished processing the video queue.");
}

// Debounced function to call processVideoQueue
const debouncedProcess = () => {
    clearTimeout(processTimeout);
    processTimeout = setTimeout(processVideoQueue, 1500);
};

// Use a MutationObserver to find new videos as they are added to the page.
function observeVideos() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const videoContainers = node.matches('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer') ? [node] : node.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer');
                        videoContainers.forEach(el => {
                            if (!videoQueue.has(el)) {
                                videoQueue.add(el);
                            }
                        });
                    }
                });
                debouncedProcess();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer').forEach(el => {
            if (!videoQueue.has(el)) {
                videoQueue.add(el);
            }
        });
        debouncedProcess();
    }, 500);
}

// Run the observer on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        observeVideos();
    });
} else {
    observeVideos();
}