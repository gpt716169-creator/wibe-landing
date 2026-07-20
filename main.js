// WIBE Interactive Storytelling Engine

const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d');

const totalFrames = 274;
const frames = [];
let loadedCount = 0;

// Elements
const preloader = document.getElementById('preloader');
const loaderBar = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');

const responsiveCards = [
    document.getElementById('step-card-1'),
    document.getElementById('step-card-2'),
    document.getElementById('step-card-3'),
    
    document.getElementById('adv-card-1'),
    document.getElementById('adv-card-2'),
    document.getElementById('adv-card-3'),
    document.getElementById('adv-card-4'),
    document.getElementById('adv-card-5'),
    document.getElementById('adv-card-6'),
    
    document.getElementById('bento-card-1'),
    document.getElementById('bento-card-2'),
    document.getElementById('bento-card-3'),
    document.getElementById('bento-card-4')
];

let cachedDocHeight = 0;
let cachedPhaseAEndScroll = 0;
let cachedWindowHeight = 0;
let cachedCardOffsets = [];
let cachedDpr = 1;

// Generate frame paths: public/frames/frame_0001.webp - frame_0428.webp
const framePaths = [];
for (let i = 1; i <= totalFrames; i++) {
    const pad = String(i).padStart(4, '0');
    framePaths.push(`public/frames/frame_${pad}.webp`);
}

// Preload Images using a concurrency queue to prevent browser request dropouts
function preloadImages(callback) {
    const concurrency = 12; // Maximum concurrent HTTP requests
    let nextIndex = 0;
    
    // Pre-fill frames array with nulls
    for (let i = 0; i < totalFrames; i++) {
        frames.push(null);
    }
    
    function loadNext() {
        if (nextIndex >= totalFrames) return;
        
        const currentIndex = nextIndex++;
        const path = framePaths[currentIndex];
        const img = new Image();
        img.src = path;
        
        img.onload = img.onerror = (e) => {
            if (e.type === 'error') {
                console.error(`Failed to load frame: ${path}`);
            }
            
            loadedCount++;
            const percent = Math.floor((loadedCount / totalFrames) * 100);
            loaderBar.style.width = `${percent}%`;
            loaderPercent.textContent = `${percent}%`;
            
            if (loadedCount === totalFrames) {
                setTimeout(() => {
                    // Hide Preloader
                    preloader.classList.add('opacity-0');
                    preloader.classList.add('pointer-events-none');
                    canvas.classList.remove('opacity-0');
                    
                    // Completely remove preloader from rendering passes after transition
                    setTimeout(() => {
                        preloader.style.display = 'none';
                    }, 1000);
                    
                    // Remove CSS transition classes after initial load fade-in,
                    // so scroll-driven opacity changes react instantly.
                    setTimeout(() => {
                        canvas.classList.remove('transition-opacity', 'duration-1000');
                    }, 1000);
                    
                    callback();
                }, 500); // Small delay to let user see 100% finished
            } else {
                loadNext(); // Process next image in the queue
            }
        };
        
        frames[currentIndex] = img;
    }
    
    // Start initial batch of requests
    for (let i = 0; i < Math.min(concurrency, totalFrames); i++) {
        loadNext();
    }
}

// Fit image into Canvas containing it
function drawFrame(img) {
    if (!img) return;
    
    try {
        // Clear canvas (in physical pixels)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Calculate logical dimensions (since context is scaled by cachedDpr)
        const canvasWidth = canvas.width / cachedDpr;
        const canvasHeight = canvas.height / cachedDpr;
        const imgWidth = img.width;
        const imgHeight = img.height;
        
        // Safety check to prevent division by zero or NaN
        if (imgWidth === 0 || imgHeight === 0 || canvasWidth === 0 || canvasHeight === 0) {
            return;
        }
        
        // Calculate aspect ratios
        const imgRatio = imgWidth / imgHeight;
        const canvasRatio = canvasWidth / canvasHeight;
        
        let drawWidth, drawHeight, x, y;
        
        if (imgRatio > canvasRatio) {
            // Image is wider than canvas
            drawWidth = canvasWidth;
            drawHeight = canvasWidth / imgRatio;
            x = 0;
            y = (canvasHeight - drawHeight) / 2;
        } else {
            // Image is taller than canvas
            drawWidth = canvasHeight * imgRatio;
            drawHeight = canvasHeight;
            x = (canvasWidth - drawWidth) / 2;
            y = 0;
        }
        
        // Bulletproof coordinates check
        if (isNaN(x) || isNaN(y) || isNaN(drawWidth) || isNaN(drawHeight)) {
            return;
        }
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
    } catch (err) {
        console.error("Error drawing canvas frame:", err);
    }
}

let lastWidth = 0;
let lastHeight = 0;

// Resize Canvas
function resizeCanvas() {
    try {
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        
        // Skip resize if dimensions haven't meaningfully changed (e.g. mobile address bar scroll collapse)
        const widthChanged = currentWidth !== lastWidth;
        const heightChanged = Math.abs(currentHeight - lastHeight) > 120;
        
        if (lastWidth > 0 && !widthChanged && !heightChanged) {
            return;
        }
        
        lastWidth = currentWidth;
        lastHeight = currentHeight;
        
        // Lock container height to the current viewport height (prevents shifts when URL bar collapses/expands)
        const container = document.getElementById('canvas-container');
        if (container) {
            container.style.height = `${currentHeight}px`;
        }
        
        cachedDpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        
        // Set internal resolution based on cachedDpr and size
        canvas.width = rect.width * cachedDpr;
        canvas.height = rect.height * cachedDpr;
        
        ctx.scale(cachedDpr, cachedDpr);
        
        // Update cached layout values
        cachedWindowHeight = currentHeight;
        cachedDocHeight = document.documentElement.scrollHeight - cachedWindowHeight;

        const advSection = document.getElementById('advantages-section');
        if (advSection) {
            cachedPhaseAEndScroll = advSection.offsetTop - (cachedWindowHeight * 0.2);
        } else {
            cachedPhaseAEndScroll = cachedDocHeight * 0.58;
        }

        // Precalculate card positions relative to the document
        cachedCardOffsets = responsiveCards.map(card => {
            if (!card) return null;
            
            // Find absolute top position of the card element relative to the document
            let absoluteTop = 0;
            let el = card;
            while (el) {
                absoluteTop += el.offsetTop;
                el = el.offsetParent;
            }
            
            const height = card.offsetHeight;
            const absoluteCenter = absoluteTop + height / 2;
            
            return {
                element: card,
                absoluteCenter: absoluteCenter,
                isStepCard: card.id.startsWith('step-card-')
            };
        }).filter(item => item !== null);
        
        // Redraw current frame after resize
        updateFrameOnScroll();
    } catch (err) {
        console.error("Error resizing canvas:", err);
    }
}

let targetFrameIndex = 0;
let currentFrameIndex = 0;
let lastRenderedIndex = -1;
let scrollProgress = 0;
let lastPhase = 'A';
let isTransitioning = false;

// Dynamic ease config: direct mapping on mobile/touch screens (since native touch scroll has built-in inertia),
// and fast snappy response on desktop (ease = 0.35).
let lerpEase = 0.35;
if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches) {
    lerpEase = 1.0; // Instant response on mobile!
}

function getSceneNumber(idx) {
    if (idx < 60) return 0; // Phase A (Original video)
    if (idx < 110) return 1; // Phase B Scene 1
    if (idx < 206) return 2; // Phase B Scene 2
    return 3; // Phase B Scene 3
}

// Update Frame based on Scroll progress
// Phase A (0px to advantages-section offset): Original 60 frames play forward and backward
// Phase B (advantages-section offset to page end): Scene 1, 2, 3 play forward (indices 60 to 273)
function updateFrameOnScroll() {
    if (frames.length === 0) return;
    
    try {
        const scrollTop = window.scrollY;
        
        // Calculate progress (0 to 1)
        let progress = 0;
        if (cachedDocHeight > 0) {
            progress = scrollTop / cachedDocHeight;
        }
        
        // Cap progress
        progress = Math.min(Math.max(progress, 0), 1);
        scrollProgress = progress;
        
        const currentPhase = scrollTop <= cachedPhaseAEndScroll ? 'A' : 'B';
        if (currentPhase !== lastPhase) {
            // Phase changed! Instantly snap the current index to avoid playing intermediate frames during LERP slide
            if (currentPhase === 'A') {
                currentFrameIndex = 0;
            } else {
                currentFrameIndex = 60;
            }
            lastPhase = currentPhase;
        }
        
        if (currentPhase === 'A') {
            // Phase A: Original 60 frames play forward (0-50% phase progress) and backward (50-100% phase progress)
            let phaseProgress = 0;
            if (cachedPhaseAEndScroll > 0) {
                phaseProgress = Math.min(Math.max(scrollTop / cachedPhaseAEndScroll, 0), 1);
            }
            
            if (phaseProgress <= 0.5) {
                // Forward (0 to 59)
                const stageProgress = phaseProgress / 0.5; // 0 to 1
                targetFrameIndex = Math.min(Math.floor(stageProgress * 59), 59);
            } else {
                // Backward (59 to 0)
                const stageProgress = (1.0 - phaseProgress) / 0.5; // 1 to 0
                targetFrameIndex = Math.min(Math.floor(stageProgress * 59), 59);
            }
        } else {
            // Phase B: Scenes 1, 2, 3 play forward (indices 60 to 273)
            let phaseProgress = 0;
            const phaseBRange = cachedDocHeight - cachedPhaseAEndScroll;
            if (phaseBRange > 0) {
                phaseProgress = Math.min(Math.max((scrollTop - cachedPhaseAEndScroll) / phaseBRange, 0), 1);
            }
            
            // Map progress to finish the animation near the end (at 88% of Phase B scroll)
            // This leaves the remaining 12% of the scroll static on the final frame,
            // showing the phone with the Telegram start button 100% clearly during the Bento CTA cards.
            const clampedProgress = Math.min(phaseProgress / 0.88, 1.0);
            
            const sceneFrameCount = totalFrames - 60; // 274 - 60 = 214 frames
            const relativeIndex = Math.floor(clampedProgress * (sceneFrameCount - 1));
            targetFrameIndex = 60 + Math.min(Math.max(relativeIndex, 0), sceneFrameCount - 1);
        }
    } catch (err) {
        console.error("Error calculating scroll progress:", err);
    }
}

// Lerping frame animation loop
function animate() {
    try {
        const target = Math.min(Math.max(targetFrameIndex, 0), totalFrames - 1);
        
        currentFrameIndex += (target - currentFrameIndex) * lerpEase;
        
        // Safe rounded index within bounds [0, totalFrames - 1]
        let roundedIndex = Math.round(currentFrameIndex);
        roundedIndex = Math.min(Math.max(roundedIndex, 0), totalFrames - 1);
        
        // Only redraw if frame index actually changed to save GPU/CPU cycles
        if (roundedIndex !== lastRenderedIndex && frames[roundedIndex]) {
            drawFrame(frames[roundedIndex]);
            lastRenderedIndex = roundedIndex;
        }
    } catch (err) {
        console.error("Error in animation loop step:", err);
    }
    
    // Always request the next frame to prevent loop crash
    requestAnimationFrame(animate);
}

function highlightActiveCards() {
    if (cachedCardOffsets.length === 0) return;
    
    const scrollTop = window.scrollY;
    const centerY = cachedWindowHeight / 2;
    const absoluteViewportCenter = scrollTop + centerY;
    
    let minDistance = Infinity;
    
    // Find the minimum distance to viewport center using cached absolute positions
    cachedCardOffsets.forEach(card => {
        const distance = Math.abs(absoluteViewportCenter - card.absoluteCenter);
        if (distance < minDistance) {
            minDistance = distance;
        }
    });
    
    // Highlight cards that are at/near the minimum distance
    cachedCardOffsets.forEach(card => {
        const distance = Math.abs(absoluteViewportCenter - card.absoluteCenter);
        
        // Highlight active cards (allowing a 40px buffer for horizontal rows on desktop)
        if (distance <= minDistance + 40) {
            if (card.isStepCard) {
                card.element.classList.add('step-card-active');
            } else {
                card.element.classList.add('card-highlight');
            }
        } else {
            card.element.classList.remove('step-card-active');
            card.element.classList.remove('card-highlight');
        }
    });
}

// Start
let initialResizeDone = false;
preloadImages(() => {
    // Initial size setup
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Listen to scroll
    window.addEventListener('scroll', () => {
        if (!initialResizeDone) {
            resizeCanvas();
            initialResizeDone = true;
        }
        updateFrameOnScroll();
        highlightActiveCards();
    }, { passive: true });
    
    // Safety triggers: resize after load events to handle Tailwind dynamic injection delay
    window.addEventListener('load', () => {
        resizeCanvas();
        setTimeout(resizeCanvas, 150);
    });
    
    // Fallback timer resize
    setTimeout(() => {
        resizeCanvas();
    }, 100);
    setTimeout(() => {
        resizeCanvas();
    }, 300);
    
    // Initial calls
    updateFrameOnScroll();
    highlightActiveCards();
    animate();

    // Instant Telegram Deep Linking with graceful web fallback
    const ctaButton = document.getElementById('cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            const deepLink = "tg://resolve?domain=sheinwibebot";
            const webLink = "https://t.me/sheinwibebot";
            
            // Try to open Telegram native app directly (bypasses browser preview screen)
            window.location.href = deepLink;
            
            // Fallback to t.me preview URL if the app doesn't launch (e.g. not installed)
            const start = Date.now();
            setTimeout(() => {
                // If browser tab stayed in foreground (app didn't open), time difference will be ~1s.
                // If app did open, browser throttled the loop and time difference will be >1.5s.
                if (Date.now() - start < 1500) {
                    window.open(webLink, '_blank');
                }
            }, 1000);
        });
    }
});
